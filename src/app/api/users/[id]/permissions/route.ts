
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase, toObjectId } from '@/lib/mongodb';

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
        const permDoc = await db.collection('permissions').findOne({ userId: userId });
        
        if (!permDoc) {
            return NextResponse.json({ buckets: [] });
        }
        
        // MongoDB stores _id, which we don't need in the response.
        const { _id, ...permissions } = permDoc;
        return NextResponse.json(permissions);

    } catch (error) {
        console.error("Failed to get user permissions:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.role || !['admin', 'owner'].includes(session.user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: userId } = params;
    const { buckets } = await request.json();

    if (!Array.isArray(buckets)) {
        return NextResponse.json({ error: 'Invalid payload, buckets must be an array.' }, { status: 400 });
    }

    try {
        const { db } = await connectToDatabase();
        const permissionsCollection = db.collection('permissions');
        const usersCollection = db.collection('users');

        const [targetUser, currentPermissions] = await Promise.all([
          usersCollection.findOne({ _id: toObjectId(userId) }),
          permissionsCollection.findOne({ userId })
        ]);

        if (!targetUser) {
           return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        await permissionsCollection.updateOne(
            { userId: userId },
            {
                $set: {
                    userId: userId,
                    buckets: buckets,
                    updatedAt: new Date(),
                    updatedBy: session.user.id,
                }
            },
            { upsert: true }
        );

        const oldBuckets = new Set(currentPermissions?.buckets || []);
        const newBuckets = new Set(buckets);
        const addedBuckets = buckets.filter(b => !oldBuckets.has(b));
        const removedBuckets = (currentPermissions?.buckets || []).filter(b => !newBuckets.has(b));
        
        if (addedBuckets.length > 0 || removedBuckets.length > 0) {
            const logEntry = {
                timestamp: new Date(),
                eventType: 'PERMISSIONS_CHANGE',
                actor: { userId: session.user.id, email: session.user.email },
                target: { userId: userId, userEmail: targetUser.email, userName: targetUser.name },
                details: { addedBuckets, removedBuckets }
            };
            await db.collection('auditLogs').insertOne(logEntry);
        }

        return NextResponse.json({ success: true, buckets });
    } catch (error) {
        console.error("Failed to update user permissions:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
