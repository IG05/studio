
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { S3Client, GetObjectCommand, DeleteObjectCommand, PutObjectCommand, GetBucketLocationCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import type { S3CommanderUser } from '@/lib/types';
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

const getS3Client = async (bucketName: string) => {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION) {
        throw new Error("Server is not configured for AWS access.");
    }
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

    return new S3Client({
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
        region: region,
    });
};


// GET handler for presigned URLs (download/view) or raw content for viewer
export async function GET(
    request: NextRequest,
    context: { params: { bucketName: string; key: string[] } }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.role) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bucketName, key: keyParts } = context.params;
    const objectKey = keyParts.join('/');
    const { searchParams } = new URL(request.url);
    const forDownload = searchParams.get('for_download');
    const forViewer = searchParams.get('for_viewer');

    try {
        const s3Client = await getS3Client(bucketName);
        const command = new GetObjectCommand({ Bucket: bucketName, Key: objectKey });
        
        // Return raw content for the in-app viewer
        if (forViewer === 'true') {
            const { Body } = await s3Client.send(command);
            if (!Body) {
                return NextResponse.json({ error: 'File is empty.' }, { status: 404 });
            }
            // Use transformToByteArray to handle various content types, then decode
            const byteArray = await Body.transformToByteArray();
            const content = new TextDecoder().decode(byteArray);
            return new Response(content, { headers: { 'Content-Type': 'text/plain' } });
        }

        // Return presigned URL for viewing in browser or downloading
        const commandParams: { Bucket: string, Key: string, ResponseContentDisposition?: string } = {
            Bucket: bucketName,
            Key: objectKey,
        };
        if (forDownload === 'true') {
            const filename = objectKey.split('/').pop() || objectKey;
            commandParams.ResponseContentDisposition = `attachment; filename="${filename}"`;
        }

        const signedUrl = await getSignedUrl(s3Client, new GetObjectCommand(commandParams), { expiresIn: 60 });
        return NextResponse.json({ url: signedUrl });

    } catch (error: any) {
        console.error(`Failed to generate signed URL for ${objectKey} in bucket ${bucketName}:`, error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        return NextResponse.json({ error: `Failed to create download link. Detail: ${errorMessage}` }, { status: 500 });
    }
}

// DELETE handler for objects
export async function DELETE(
    request: NextRequest,
    context: { params: { bucketName: string; key: string[] } }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.role) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = session.user as S3CommanderUser;
    const { bucketName, key: keyParts } = context.params;
    const objectKey = keyParts.join('/');

    const hasAccess = await checkWriteAccess(user, bucketName);
    if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden: Write access required.' }, { status: 403 });
    }

    try {
        const s3Client = await getS3Client(bucketName);
        const command = new DeleteObjectCommand({ Bucket: bucketName, Key: objectKey });
        await s3Client.send(command);
        
        return NextResponse.json({ success: true, message: 'Object deleted successfully' });

    } catch (error: any) {
        console.error(`Failed to delete object ${objectKey} in bucket ${bucketName}:`, error);
        return NextResponse.json({ error: 'Failed to delete object.' }, { status: 500 });
    }
}

// PUT handler for generating presigned upload URLs and creating folders
export async function PUT(
    request: NextRequest,
    context: { params: { bucketName: string; key: string[] } }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.role) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as S3CommanderUser;
    const { bucketName, key: keyParts } = context.params;
    const objectKey = keyParts.join('/');

    const hasAccess = await checkWriteAccess(user, bucketName);
    if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden: Write access required.' }, { status: 403 });
    }
    
    try {
        const s3Client = await getS3Client(bucketName);
        
        // If the key ends with a '/', it's a folder creation request.
        if (objectKey.endsWith('/')) {
            const command = new PutObjectCommand({ 
                Bucket: bucketName, 
                Key: objectKey, 
                Body: '', // Zero-byte body for folder creation
            });
            await s3Client.send(command);
            return NextResponse.json({ success: true, message: 'Folder created successfully' });
        } else {
            // Otherwise, it's a file upload request, so we generate a presigned URL.
            try {
                const body = await request.json();
                const contentType = body.contentType;

                if (!contentType) {
                    return NextResponse.json({ error: 'Content-Type is required for file uploads.' }, { status: 400 });
                }

                const command = new PutObjectCommand({ 
                    Bucket: bucketName, 
                    Key: objectKey,
                    ContentType: contentType,
                });
                const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 minute expiry

                return NextResponse.json({ url: signedUrl });
            } catch (error) {
                 return NextResponse.json({ error: 'Invalid request body. For file uploads, a JSON body with contentType is required.' }, { status: 400 });
            }
        }
    } catch (error: any) {
        console.error(`Failed to process PUT request for ${objectKey} in bucket ${bucketName}:`, error);
        return NextResponse.json({ error: 'Failed to create resource.' }, { status: 500 });
    }
}
