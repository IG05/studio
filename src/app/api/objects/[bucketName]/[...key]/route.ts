
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { S3Client, GetObjectCommand, DeleteObjectCommand, PutObjectCommand, GetBucketLocationCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import type { S3CommanderUser, UserPermissions } from '@/lib/types';
import { connectToDatabase } from '@/lib/mongodb';
import { isAfter } from 'date-fns';

async function checkAccess(user: S3CommanderUser, bucketName: string, permissionType: 'write' | 'delete'): Promise<boolean> {
    if (['admin', 'owner'].includes(user.role)) {
        return true;
    }
    
    const { db } = await connectToDatabase();

    // Check permanent permissions first
    const permDoc = await db.collection('permissions').findOne({ userId: user.id });
    if (permDoc) {
        const permissions = permDoc as unknown as UserPermissions;
        if (permissionType === 'delete') {
            return !!permissions.canDelete;
        }
        if (permissionType === 'write') {
            if (permissions.write?.access === 'all') return true;
            if (permissions.write?.access === 'selective' && permissions.write.buckets?.includes(bucketName)) {
                return true;
            }
        }
    }
    
    // If checking for delete, and user doesn't have permanent delete, they can't delete.
    if (permissionType === 'delete') {
        return false;
    }

    // Check for temporary write access
    const tempPermission = await db.collection('accessRequests').findOne({
        userId: user.id,
        bucketName: bucketName,
        status: 'approved',
        expiresAt: { $exists: true, $ne: null, $gt: new Date() }
    });

    return !!tempPermission;
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
    const user = session.user as S3CommanderUser;
    const { bucketName } = context.params;
    const objectKey = decodeURIComponent(context.params.key.join('/'));


    const { searchParams } = new URL(request.url);
    const forDownload = searchParams.get('for_download');
    const forViewer = searchParams.get('for_viewer');

    try {
        const s3Client = await getS3Client(bucketName);
        const command = new GetObjectCommand({ Bucket: bucketName, Key: objectKey });
        
        // Return raw content for the in-app viewer
        if (forViewer === 'true') {
            const { Body, ContentType } = await s3Client.send(command);
            if (!Body) {
                return NextResponse.json({ error: 'File is empty.' }, { status: 404 });
            }
            // Use transformToByteArray to handle various content types, then decode
            const byteArray = await Body.transformToByteArray();
            return new Response(byteArray, { headers: { 'Content-Type': ContentType || 'application/octet-stream' } });
        }

        // Return presigned URL for viewing in browser or downloading
        const commandParams: { Bucket: string, Key: string, ResponseContentDisposition?: string } = {
            Bucket: bucketName,
            Key: objectKey,
        };
        if (forDownload === 'true') {
            const filename = objectKey.split('/').pop() || objectKey;
            commandParams.ResponseContentDisposition = `attachment; filename="${filename}"`;
            
            // Log the download action
            const { db } = await connectToDatabase();
            await db.collection('auditLogs').insertOne({
                timestamp: new Date(),
                eventType: 'FILE_DOWNLOAD',
                actor: { userId: user.id, email: user.email },
                target: { bucketName, objectKey },
                details: {}
            });
        }

        const signedUrl = await getSignedUrl(s3Client, new GetObjectCommand(commandParams), { expiresIn: 60 });
        return NextResponse.json({ url: signedUrl });

    } catch (error: any) {
        console.error(`Failed to generate signed URL for ${objectKey} in bucket ${bucketName}:`, error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        return NextResponse.json({ error: `Failed to create download link. Detail: ${errorMessage}` }, { status: 500 });
    }
}

// DELETE handler for objects and folders
export async function DELETE(
    request: NextRequest,
    context: { params: { bucketName: string; key: string[] } }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.role) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = session.user as S3CommanderUser;
    const { bucketName } = context.params;
    const objectKey = decodeURIComponent(context.params.key.join('/'));

    const hasWrite = await checkAccess(user, bucketName, 'write');
    const hasDelete = await checkAccess(user, bucketName, 'delete');

    if (!hasWrite || !hasDelete) {
        return NextResponse.json({ error: 'Forbidden: Write and Delete permissions required.' }, { status: 403 });
    }
    
    try {
        const s3Client = await getS3Client(bucketName);
        const { db } = await connectToDatabase();
        
        // If key ends with '/', it's a folder deletion request
        if (objectKey.endsWith('/')) {
            const listCommand = new ListObjectsV2Command({
                Bucket: bucketName,
                Prefix: objectKey,
            });
            const listedObjects = await s3Client.send(listCommand);

            if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
                 // Even if the folder is empty, we might need to delete the placeholder object.
                const deletePlaceholder = new DeleteObjectCommand({ Bucket: bucketName, Key: objectKey });
                await s3Client.send(deletePlaceholder);
            } else {
                 const deleteParams = {
                    Bucket: bucketName,
                    Delete: { Objects: listedObjects.Contents.map(({ Key }) => ({ Key })) },
                };
                await s3Client.send(new DeleteObjectsCommand(deleteParams));
            }
             await db.collection('auditLogs').insertOne({
                timestamp: new Date(),
                eventType: 'OBJECT_DELETE',
                actor: { userId: user.id, email: user.email },
                target: { bucketName, objectKey },
                details: { type: 'folder' }
            });
            return NextResponse.json({ success: true, message: 'Folder and its contents deleted successfully' });

        } else { // It's a single file deletion
            const command = new DeleteObjectCommand({ Bucket: bucketName, Key: objectKey });
            await s3Client.send(command);
             await db.collection('auditLogs').insertOne({
                timestamp: new Date(),
                eventType: 'OBJECT_DELETE',
                actor: { userId: user.id, email: user.email },
                target: { bucketName, objectKey },
                details: { type: 'file' }
            });
            return NextResponse.json({ success: true, message: 'Object deleted successfully' });
        }

    } catch (error: any) {
        console.error(`Failed to delete object/folder ${objectKey} in bucket ${bucketName}:`, error);
        return NextResponse.json({ error: 'Failed to delete object.' }, { status: 500 });
    }
}

// PUT handler for creating folders.
export async function PUT(
    request: NextRequest,
    context: { params: { bucketName: string; key: string[] } }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.role) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as S3CommanderUser;
    const { bucketName } = context.params;
    const objectKey = decodeURIComponent(context.params.key.join('/'));
    
    const hasWriteAccess = await checkAccess(user, bucketName, 'write');
    if (!hasWriteAccess) {
        return NextResponse.json({ error: 'Forbidden: Write access required.' }, { status: 403 });
    }

    // This route is ONLY for folder creation. It must end with a slash.
    if (!objectKey.endsWith('/')) {
        return NextResponse.json({ error: 'Invalid request for folder creation. Use POST for file uploads.' }, { status: 400 });
    }

    try {
        const s3Client = await getS3Client(bucketName);
        const command = new PutObjectCommand({ 
            Bucket: bucketName, 
            Key: objectKey,
            Body: '', // Zero-byte body for folder creation
        });
        await s3Client.send(command);

        const { db } = await connectToDatabase();
        await db.collection('auditLogs').insertOne({
            timestamp: new Date(),
            eventType: 'FOLDER_CREATE',
            actor: { userId: user.id, email: user.email },
            target: { bucketName, objectKey },
            details: {}
        });

        return NextResponse.json({ success: true, message: 'Folder created successfully' });
    } catch (error: any) {
         console.error(`Failed to create folder ${objectKey} in bucket ${bucketName}:`, error);
         return NextResponse.json({ error: 'Failed to create folder.' }, { status: 500 });
    }
}


// POST handler for proxied file uploads.
export async function POST(
    request: NextRequest,
    context: { params: { bucketName: string; key: string[] } }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.role) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as S3CommanderUser;
    const { bucketName } = context.params;
    const objectKey = decodeURIComponent(context.params.key.join('/'));

    const hasWriteAccess = await checkAccess(user, bucketName, 'write');
    if (!hasWriteAccess) {
        return NextResponse.json({ error: 'Forbidden: Write access required.' }, { status: 403 });
    }
    
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file found in the request body.' }, { status: 400 });
        }
        
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        
        const s3Client = await getS3Client(bucketName);
        
        const command = new PutObjectCommand({ 
            Bucket: bucketName, 
            Key: objectKey,
            Body: fileBuffer,
            ContentType: file.type || undefined,
            ContentLength: file.size,
        });

        await s3Client.send(command);

        const { db } = await connectToDatabase();
        await db.collection('auditLogs').insertOne({
            timestamp: new Date(),
            eventType: 'FILE_UPLOAD',
            actor: { userId: user.id, email: user.email },
            target: { bucketName, objectKey },
            details: {
                size: file.size,
                contentType: file.type,
            }
        });

        return NextResponse.json({ success: true, message: 'File uploaded successfully' });
    } catch (error: any) {
        console.error(`Failed to upload file ${objectKey} in bucket ${bucketName}:`, error);
        return NextResponse.json({ error: 'Failed to upload file.' }, { status: 500 });
    }
}
