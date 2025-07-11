
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase, toObjectId, fromMongo } from '@/lib/mongodb';

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    // Ensure user is the owner to change roles
    if (session?.user?.role !== 'owner') {
        return NextResponse.json({ error: 'Forbidden: Only the owner can change user roles.' }, { status: 403 });
    }

    const userToUpdateId = toObjectId(params.id);
    if (!userToUpdateId) {
        return NextResponse.json({ error: 'Invalid user ID format' }, { status: 400 });
    }

    try {
        const body = await request.json();
        const { role, reason: providedReason } = body;

        if (role !== 'ADMIN' && role !== 'USER') {
            return NextResponse.json({ error: 'Invalid role provided.' }, { status: 400 });
        }

        const reason = providedReason || `Role changed to ${role} by owner.`;

        const { db } = await connectToDatabase();
        const usersCollection = db.collection('users');

        // Fetch user before update to get original role for logging
        const userToUpdate = await usersCollection.findOne({ _id: userToUpdateId });
        if (!userToUpdate) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Owner cannot change their own role.
        if (userToUpdate._id.toString() === session.user.id) {
            return NextResponse.json({ error: 'Owner cannot change their own role.' }, { status: 400 });
        }
        
        const originalRole = userToUpdate.role;

        const result = await usersCollection.findOneAndUpdate(
            { _id: userToUpdateId },
            { $set: { role } },
            { returnDocument: 'after' }
        );

        if (!result) {
            // This should not happen if the findOne above succeeded, but as a safeguard.
            return NextResponse.json({ error: 'User not found during update' }, { status: 404 });
        }

        // Create an audit log entry for the role change
        const logEntry = {
            timestamp: new Date(),
            eventType: 'ROLE_CHANGE',
            actor: { userId: session.user.id, email: session.user.email },
            target: { userId: params.id, userEmail: userToUpdate.email, userName: userToUpdate.name },
            details: { fromRole: originalRole, toRole: role, reason }
        };
        await db.collection('auditLogs').insertOne(logEntry);

        return NextResponse.json(fromMongo(result));

    } catch (error) {
        console.error("Failed to update user role:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
