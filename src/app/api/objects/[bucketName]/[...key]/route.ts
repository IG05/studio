
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { S3Client, GetObjectCommand, GetBucketLocationCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import type { S3CommanderUser } from '@/lib/types';
import { db } from '@/lib/firebase';
import { isAfter } from 'date-fns';

async function checkAccess(user: S3CommanderUser, bucketName: string): Promise<boolean> {
    if (['admin', 'owner'].includes(user.role)) {
        return true;
    }

    // Check for permanent access first
    const permDoc = await db.collection('permissions').doc(user.id).get();
    if (permDoc.exists) {
        const permissions = permDoc.data();
        if (permissions?.buckets?.includes(bucketName)) {
            return true;
        }
    }

    // If no permanent access, check for temporary access
    const snapshot = await db.collection('accessRequests')
        .where('userId', '==', user.id)
        .where('bucketName', '==', bucketName)
        .where('status', '==', 'approved')
        .get();

    if (snapshot.empty) {
        return false;
    }
    
    // Check if there is at least one non-expired permission
    const hasValidTempPermission = snapshot.docs.some(doc => {
        const tempPermission = doc.data();
        // If expiresAt is not set, it's considered non-expiring. If it is set, check if it's in the future.
        return !tempPermission.expiresAt || !isAfter(new Date(), tempPermission.expiresAt.toDate());
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
