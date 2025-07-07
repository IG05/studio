
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import type { Bucket, S3CommanderUser } from '@/lib/types';
import { S3Client, ListBucketsCommand, GetBucketLocationCommand } from '@aws-sdk/client-s3';
import { CloudWatchClient, GetMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { connectToDatabase } from '@/lib/mongodb';
import { isAfter } from 'date-fns';

async function getPermanentPermissions(userId: string): Promise<string[]> {
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

    try {
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

        const [s3BucketsResult, tempPermissionsResult, permanentPermissions] = await Promise.all([
            s3Client.send(new ListBucketsCommand({})),
            !isAdminOrOwner ? db.collection('accessRequests').find({ userId: user.id, status: 'approved' }).toArray() : Promise.resolve([]),
            !isAdminOrOwner ? getPermanentPermissions(user.id) : Promise.resolve([])
        ]);

        const { Buckets: s3Buckets } = s3BucketsResult;

        if (!s3Buckets) {
            return NextResponse.json([]);
        }
        
        let tempPermissions = tempPermissionsResult || [];

        const bucketDataPromises = s3Buckets.map(async (bucket) => {
            const bucketName = bucket.Name!;
            let region = process.env.AWS_REGION!;

            try {
                const location = await s3Client.send(new GetBucketLocationCommand({ Bucket: bucketName }));
                region = location.LocationConstraint || 'us-east-1';
            } catch (e) {
                console.warn(`Could not get location for bucket ${bucketName}, defaulting to ${region}. Error:`, e);
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

            let access: Bucket['access'] = 'none';
            let tempAccessExpiresAt: string | undefined = undefined;

            if (isAdminOrOwner || permanentPermissions.includes(bucketName)) {
                access = 'full';
            } else {
                const permission = tempPermissions.find(p => p.bucketName === bucketName);
                if (permission) {
                    if (permission.expiresAt && isAfter(new Date(), permission.expiresAt)) {
                        access = 'none';
                    } else {
                        access = 'limited';
                        tempAccessExpiresAt = permission.expiresAt?.toISOString();
                    }
                }
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
        const accessQuery = searchParams.get('access');

        let filteredBuckets = allBuckets;

        if (regionQuery) {
            filteredBuckets = filteredBuckets.filter(b => b.region === regionQuery);
        }

        if (accessQuery) {
            const allowedAccessLevels = accessQuery.split(',');
            filteredBuckets = filteredBuckets.filter(b => allowedAccessLevels.includes(b.access));
        }
        
        return NextResponse.json(filteredBuckets);

    } catch (error: any) {
        console.error("Error fetching buckets:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        return NextResponse.json({ error: `Failed to fetch buckets from AWS. Detail: ${errorMessage}` }, { status: 500 });
    }
}
