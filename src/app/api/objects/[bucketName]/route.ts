
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { S3Client, ListObjectsV2Command, GetBucketLocationCommand } from '@aws-sdk/client-s3';
import type { _Object, CommonPrefix } from '@aws-sdk/client-s3';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import type { S3Object, S3CommanderUser } from '@/lib/types';
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
    context: { params: { bucketName: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.role) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Explicitly check for AWS credentials
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION) {
        console.error("Missing AWS configuration in .env file");
        return NextResponse.json({ error: 'Server is not configured for AWS access. Please check server logs.' }, { status: 500 });
    }
    
    const user = session.user as S3CommanderUser;
    const bucketName = context.params.bucketName;

    // --- Access Control Logic ---
    const hasAccess = await checkAccess(user, bucketName);
    if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // --- End Access Control ---

    try {
        // This client can be initialized without a specific region to get bucket location.
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
            region = location.LocationConstraint || 'us-east-1'; // us-east-1 is the default and returns null
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
            lastModified: new Date().toISOString(), // S3 doesn't provide this for folders
            size: undefined,
        }));

        const files: S3Object[] = (Contents as _Object[])
            .filter(obj => obj.Key !== command.input.Prefix) // Exclude the folder itself
            .map(obj => ({
                key: obj.Key!,
                type: 'file',
                size: obj.Size!,
                lastModified: obj.LastModified!.toISOString(),
            }));
        
        const allObjects = [...folders, ...files].sort((a,b) => a.key.localeCompare(b.key));

        return NextResponse.json(allObjects);

    } catch (error: any) {
        console.error(`Failed to list objects for bucket ${bucketName}:`, error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        if (errorMessage.includes("does not exist")) {
             return NextResponse.json({ error: `Bucket "${bucketName}" not found.` }, { status: 404 });
        }
        return NextResponse.json({ error: `Failed to fetch objects from AWS. Detail: ${errorMessage}` }, { status: 500 });
    }
}
