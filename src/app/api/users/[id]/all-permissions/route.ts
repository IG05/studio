
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase, fromMongo } from '@/lib/mongodb';
import type { AccessRequest, UserPermissions } from '@/lib/types';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.role || !['admin', 'owner'].includes(session.user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: userId } = params;

    try {
        const { db } = await connectToDatabase();

        // Fetch permanent permissions
        const permDoc = await db.collection('permissions').findOne({ userId: userId });
        const permanentPermissions: UserPermissions = {
            write: permDoc?.write || { access: 'none', buckets: [] },
            canDelete: permDoc?.canDelete || false,
        };

        // Fetch active temporary permissions
        const activeTempRequestsCursor = db.collection('accessRequests').find({
            userId: userId,
            status: 'approved',
            expiresAt: { $exists: true, $ne: null, $gt: new Date() }
        });
        
        const activeTempRequestsFromDb = await activeTempRequestsCursor.toArray();
        const temporaryAccess = activeTempRequestsFromDb.map(fromMongo) as AccessRequest[];

        const responsePayload = {
            permanent: permanentPermissions,
            temporary: temporaryAccess.map(req => ({
                bucketName: req.bucketName,
                expiresAt: req.expiresAt,
                region: req.region,
            })),
        };

        return NextResponse.json(responsePayload);

    } catch (error) {
        console.error("Failed to get user's combined permissions:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
