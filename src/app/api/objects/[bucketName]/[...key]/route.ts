
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { S3Client, GetObjectCommand, GetBucketLocationCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import type { S3CommanderUser } from '@/lib/types';
import { connectToDatabase } from '@/lib/mongodb';
import { isAfter } from 'date-fns';

async function checkAccess(user: S3CommanderUser, bucketName: string): Promise<boolean> {
    if (['admin', 'owner'].includes(user.role)) {
        return true;
    }
    
    const { db } = await connectToDatabase();

    // Check for permanent access first
    const permDoc = await db.collection('permissions').findOne({ userId: user.id });
    if (permDoc && permDoc.buckets?.includes(bucketName)) {
        return true;
    }

    // If no permanent access, check for temporary access
    const tempPermissions = await db.collection('accessRequests').find({
        userId: user.id,
        bucketName: bucketName,
        status: 'approved'
    }).toArray();


    if (tempPermissions.length === 0) {
        return false;
    }
    
    // Check if there is at least one non-expired permission
    const hasValidTempPermission = tempPermissions.some(permission => {
        // If expiresAt is not set, it's considered non-expiring. If it is set, check if it's in the future.
        return !permission.expiresAt || !isAfter(new Date(), permission.expiresAt);
    });

    return hasValidTempPermission;
}

export async function GET(
    request: NextRequest,
    context: { params: { bucketName: string; key: string[] } }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.role) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION) {
        console.error("Missing AWS configuration in .env file");
        return NextResponse.json({ error: 'Server is not configured for AWS access.' }, { status: 500 });
    }

    const user = session.user as S3CommanderUser;
    const { bucketName, key: keyParts } = context.params;
    const objectKey = keyParts.join('/');

    const hasAccess = await checkAccess(user, bucketName);
    if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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

        const commandParams: { Bucket: string, Key: string, ResponseContentDisposition?: string } = {
            Bucket: bucketName,
            Key: objectKey,
        };

        const { searchParams } = new URL(request.url);
        const forDownload = searchParams.get('for_download');

        if (forDownload === 'true') {
            const filename = objectKey.split('/').pop() || objectKey;
            commandParams.ResponseContentDisposition = `attachment; filename="${filename}"`;
        }

        const command = new GetObjectCommand(commandParams);
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 }); // Expires in 60 seconds

        return NextResponse.json({ url: signedUrl });

    } catch (error: any) {
        console.error(`Failed to generate signed URL for ${objectKey} in bucket ${bucketName}:`, error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        return NextResponse.json({ error: `Failed to create download link. Detail: ${errorMessage}` }, { status: 500 });
    }
}
