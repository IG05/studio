
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase, toObjectId } from '@/lib/mongodb';
import type { UserPermissions } from '@/lib/types';

const defaultPermissions: UserPermissions = {
    write: {
        access: 'none',
        buckets: [],
    },
    canDelete: false,
};

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
            return NextResponse.json(defaultPermissions);
        }
        
        // MongoDB stores _id, which we don't need in the response.
        const { _id, userId: docUserId, ...permissions } = permDoc;
        return NextResponse.json({
            write: permissions.write || defaultPermissions.write,
            canDelete: permissions.canDelete || defaultPermissions.canDelete
        });

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
    const { permissions, reason } = await request.json() as { permissions: UserPermissions, reason: string };

    if (!permissions || !permissions.write || !['all', 'selective', 'none'].includes(permissions.write.access)) {
        return NextResponse.json({ error: 'Invalid payload, invalid write access structure.' }, { status: 400 });
    }

    if (permissions.write.access === 'selective' && !Array.isArray(permissions.write.buckets)) {
        return NextResponse.json({ error: 'Invalid payload, selective write access requires a buckets array.' }, { status: 400 });
    }
    
    if (typeof permissions.canDelete !== 'boolean') {
        return NextResponse.json({ error: 'Invalid payload, canDelete must be a boolean.' }, { status: 400 });
    }

    if (!reason || typeof reason !== 'string' || reason.length < 10) {
        return NextResponse.json({ error: 'A reason of at least 10 characters is required.' }, { status: 400 });
    }
    
    // If access is not 'selective', ensure buckets array is empty for consistency.
    if (permissions.write.access !== 'selective') {
        permissions.write.buckets = [];
    }

    try {
        const { db } = await connectToDatabase();
        const permissionsCollection = db.collection('permissions');
        const usersCollection = db.collection('users');

        const [targetUser, currentPermissionsDoc] = await Promise.all([
          usersCollection.findOne({ _id: toObjectId(userId) }),
          permissionsCollection.findOne({ userId })
        ]);

        if (!targetUser) {
           return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const result = await permissionsCollection.updateOne(
            { userId: userId },
            {
                $set: {
                    userId: userId,
                    write: permissions.write,
                    canDelete: permissions.canDelete,
                    updatedAt: new Date(),
                    updatedBy: session.user.id,
                }
            },
            { upsert: true }
        );

        // --- Audit Logging ---
        const currentPermissions: UserPermissions = currentPermissionsDoc ? {
            write: currentPermissionsDoc.write || defaultPermissions.write,
            canDelete: currentPermissionsDoc.canDelete || defaultPermissions.canDelete,
        } : defaultPermissions;

        const changes: string[] = [];

        if (currentPermissions.write.access !== permissions.write.access) {
            changes.push(`Write access changed from '${currentPermissions.write.access}' to '${permissions.write.access}'.`);
        } else if (permissions.write.access === 'selective') {
             const oldBuckets = new Set(currentPermissions.write.buckets || []);
             const newBuckets = new Set(permissions.write.buckets || []);
             const added = (permissions.write.buckets || []).filter(b => !oldBuckets.has(b));
             const removed = (currentPermissions.write.buckets || []).filter(b => !newBuckets.has(b));
             if (added.length > 0) changes.push(`Added write access to: ${added.join(', ')}.`);
             if (removed.length > 0) changes.push(`Removed write access from: ${removed.join(', ')}.`);
        }

        if (currentPermissions.canDelete !== permissions.canDelete) {
            changes.push(`Delete permission changed to '${permissions.canDelete ? 'Enabled' : 'Disabled'}'.`);
        }
        
        if (changes.length > 0) {
            const logEntry = {
                timestamp: new Date(),
                eventType: 'PERMISSIONS_CHANGE',
                actor: { userId: session.user.id, email: session.user.email },
                target: { userId: userId, userEmail: targetUser.email, userName: targetUser.name },
                details: { permissionsChangeSummary: changes.join(' '), reason }
            };
            await db.collection('auditLogs').insertOne(logEntry);
        }

        return NextResponse.json({ success: true, permissions });
    } catch (error) {
        console.error("Failed to update user permissions:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
