
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import type { Bucket, S3CommanderUser } from '@/lib/types';
import { S3Client, GetBucketLocationCommand } from '@aws-sdk/client-s3';
import { ResourceGroupsTaggingAPIClient, GetResourcesCommand } from '@aws-sdk/client-resource-groups-tagging-api';
import { CloudWatchClient, GetMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { connectToDatabase } from '@/lib/mongodb';
import { isAfter } from 'date-fns';

async function getWritePermissions(userId: string): Promise<string[]> {
    const { db } = await connectToDatabase();
    const permDoc = await db.collection('permissions').findOne({ userId });
    return permDoc?.buckets || [];
}


export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.role) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION) {
        console.error("Missing AWS configuration in .env file");
        return NextResponse.json({ error: 'Server is not configured for AWS access. Please check server logs.' }, { status: 500 });
    }

    const tagKey = process.env.S3_VISIBILITY_TAG_KEY;
    const tagValue = process.env.S3_VISIBILITY_TAG_VALUE;

    if (!tagKey || !tagValue) {
        console.error("Missing S3_VISIBILITY_TAG_KEY or S3_VISIBILITY_TAG_VALUE in .env file");
        return NextResponse.json({ error: 'Server is not configured for bucket visibility. Please check server logs.' }, { status: 500 });
    }

    try {
        const taggingClient = new ResourceGroupsTaggingAPIClient({
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
            region: process.env.AWS_REGION!,
        });

        const s3Client = new S3Client({
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
            region: process.env.AWS_REGION!,
        });
        
        const cloudWatchClient = new CloudWatchClient({
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
            region: 'us-east-1', // S3 Storage metrics are always in us-east-1
        });

        const user = session.user as S3CommanderUser;
        const isAdminOrOwner = ['admin', 'owner'].includes(user.role);
        
        const { db } = await connectToDatabase();
        
        // Fetch buckets based on tags
        const taggedResources = await taggingClient.send(new GetResourcesCommand({
            ResourceTypeFilters: ['s3:bucket'],
            TagFilters: [{ Key: tagKey, Values: [tagValue] }]
        }));

        if (!taggedResources.ResourceTagMappingList || taggedResources.ResourceTagMappingList.length === 0) {
            return NextResponse.json([]);
        }

        const bucketArns = taggedResources.ResourceTagMappingList.map(r => r.ResourceARN!);
        const bucketNames = bucketArns.map(arn => arn.split(':::')[1]);
        
        const [tempPermissionsResult, permanentWritePermissions] = await Promise.all([
            db.collection('accessRequests').find({ userId: user.id, status: 'approved' }).toArray(),
            getWritePermissions(user.id)
        ]);

        let tempPermissions = tempPermissionsResult || [];

        const bucketDataPromises = bucketNames.map(async (bucketName) => {
            let region: string | undefined = undefined;

            try {
                const location = await s3Client.send(new GetBucketLocationCommand({ Bucket: bucketName }));
                region = location.LocationConstraint || 'us-east-1';
            } catch (e) {
                console.warn(`Could not get location for bucket ${bucketName}. Error:`, e);
            }

            const endTime = new Date();
            const startTime = new Date();
            startTime.setDate(endTime.getDate() - 3);

            let bucketSize: number | undefined = undefined;
            try {
                const metricData = await cloudWatchClient.send(new GetMetricDataCommand({
                    MetricDataQueries: [{
                        Id: 'size',
                        MetricStat: {
                            Metric: {
                                Namespace: 'AWS/S3',
                                MetricName: 'BucketSizeBytes',
                                Dimensions: [
                                    { Name: 'BucketName', Value: bucketName },
                                    { Name: 'StorageType', Value: 'StandardStorage' }
                                ]
                            },
                            Period: 86400,
                            Stat: 'Average',
                        },
                        ReturnData: true,
                    }],
                    StartTime: startTime,
                    EndTime: endTime,
                    ScanBy: 'TimestampDescending',
                }));

                if (metricData.MetricDataResults?.[0]?.Values?.[0] !== undefined) {
                    bucketSize = metricData.MetricDataResults[0].Values[0];
                }
            } catch (e) {
                console.warn(`Could not get size for bucket ${bucketName}. Maybe no objects or metrics not enabled.`);
            }

            let access: Bucket['access'] = 'read-only';
            let tempAccessExpiresAt: string | undefined = undefined;

            const hasPermanentWrite = permanentWritePermissions.includes(bucketName);
            const tempWritePermission = tempPermissions.find(p => p.bucketName === bucketName && (!p.expiresAt || !isAfter(new Date(), p.expiresAt)));
            
            if (isAdminOrOwner || hasPermanentWrite) {
                access = 'read-write';
            } else if (tempWritePermission) {
                access = 'read-write';
                tempAccessExpiresAt = tempWritePermission.expiresAt?.toISOString();
            }

            return {
                name: bucketName,
                region: region,
                access: access,
                tempAccessExpiresAt: tempAccessExpiresAt,
                size: bucketSize,
            } as Bucket;
        });

        const allBuckets = await Promise.all(bucketDataPromises);
        
        const { searchParams } = new URL(request.url);
        const regionQuery = searchParams.get('region');

        let filteredBuckets = allBuckets;

        if (regionQuery) {
            filteredBuckets = filteredBuckets.filter(b => b.region === regionQuery);
        }
        
        return NextResponse.json(filteredBuckets);

    } catch (error: any) {
        console.error("Error fetching buckets:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        return NextResponse.json({ error: `Failed to fetch buckets from AWS. Detail: ${errorMessage}` }, { status: 500 });
    }
}
