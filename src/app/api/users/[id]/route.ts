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

    // Use session.user.id which is the UID from Firebase Auth.
    // Querying users by _id won't work here since we only have UID in session.
    // We need to fetch the user by their _id, and check if their uid matches the session's uid.
    const { db } = await connectToDatabase();
    const userToUpdate = await db.collection('users').findOne({ _id: userToUpdateId });
    
    // Admins cannot change their own role
    if (userToUpdate?.uid === session.user.id) {
        return NextResponse.json({ error: 'Admins cannot change their own role.' }, { status: 400 });
    }

    try {
        const body = await request.json();
        const { role } = body;

        if (role !== 'ADMIN' && role !== 'USER') {
            return NextResponse.json({ error: 'Invalid role provided.' }, { status: 400 });
        }

        const result = await db.collection('users').findOneAndUpdate(
            { _id: userToUpdateId },
            { $set: { role } },
            { returnDocument: 'after' }
        );

        if (!result) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json(fromMongo(result));

    } catch (error) {
        console.error("Failed to update user role:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
