
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { S3Client, ListObjectsV2Command, GetBucketLocationCommand } from '@aws-sdk/client-s3';
import type { _Object, CommonPrefix } from '@aws-sdk/client-s3';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import type { S3Object, S3CommanderUser } from '@/lib/types';
import { connectToDatabase } from '@/lib/mongodb';
import { isAfter } from 'date-fns';

async function checkWriteAccess(user: S3CommanderUser, bucketName: string): Promise<boolean> {
    if (['admin', 'owner'].includes(user.role)) {
        return true;
    }
    
    const { db } = await connectToDatabase();

    const permDoc = await db.collection('permissions').findOne({ userId: user.id });
    if (permDoc && permDoc.buckets?.includes(bucketName)) {
        return true;
    }

    const tempPermissions = await db.collection('accessRequests').find({
        userId: user.id,
        bucketName: bucketName,
        status: 'approved'
    }).toArray();


    if (tempPermissions.length === 0) {
        return false;
    }
    
    const hasValidTempPermission = tempPermissions.some(permission => {
        return permission.expiresAt && !isAfter(new Date(), new Date(permission.expiresAt));
    });

    return hasValidTempPermission;
}

export async function GET(
    request: NextRequest,
    {params}: { params: { bucketName: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.role) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION) {
        console.error("Missing AWS configuration in .env file");
        return NextResponse.json({ error: 'Server is not configured for AWS access. Please check server logs.' }, { status: 500 });
    }
    
    const user = session.user as S3CommanderUser;
    const {bucketName} = await params;

    // All visible buckets are readable. Check for write access separately.
    const hasWriteAccess = await checkWriteAccess(user, bucketName);

    try {
        const s3LocationClient = new S3Client({
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
            region: process.env.AWS_REGION!,
        });

        let region = process.env.AWS_REGION!;
        try {
            const location = await s3LocationClient.send(new GetBucketLocationCommand({ Bucket: bucketName }));
            region = location.LocationConstraint || 'us-east-1';
        } catch (e) {
            console.warn(`Could not get location for bucket ${bucketName}, defaulting to ${region}. Error:`, e);
        }

        const s3Client = new S3Client({
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
            region: region,
        });

        const command = new ListObjectsV2Command({
            Bucket: bucketName,
            Delimiter: '/',
            Prefix: new URL(request.url).searchParams.get('path') || '',
        });
        
        const { Contents = [], CommonPrefixes = [] } = await s3Client.send(command);

        const folders: S3Object[] = (CommonPrefixes as CommonPrefix[]).map(p => ({
            key: p.Prefix!,
            type: 'folder',
            lastModified: new Date().toISOString(),
            size: undefined,
        }));

        const files: S3Object[] = (Contents as _Object[])
            .filter(obj => obj.Key !== command.input.Prefix) // Exclude the prefix itself if it's an object (folder placeholder)
            .map(obj => ({
                key: obj.Key!,
                type: 'file',
                size: obj.Size!,
                lastModified: obj.LastModified!.toISOString(),
            }));
        
        const allObjects = [...folders, ...files].sort((a,b) => a.key.localeCompare(b.key));

        const response = NextResponse.json(allObjects);
        response.headers.set('X-S3-Commander-Write-Access', String(hasWriteAccess));
        return response;

    } catch (error: any) {
        console.error(`Failed to list objects for bucket ${bucketName}:`, error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        if (errorMessage.includes("does not exist")) {
             return NextResponse.json({ error: `Bucket "${bucketName}" not found.` }, { status: 404 });
        }
        return NextResponse.json({ error: `Failed to fetch objects from AWS. Detail: ${errorMessage}` }, { status: 500 });
    }
}
