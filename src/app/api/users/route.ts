
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase, fromMongo } from '@/lib/mongodb';

export async function GET() {
    const session = await getServerSession(authOptions);
    // Ensure user is authenticated and is an admin or owner
    if (!session?.user?.role || !['admin', 'owner'].includes(session.user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { db } = await connectToDatabase();
        const usersFromDb = await db.collection('users').find().sort({ name: 1 }).toArray();
        
        if (usersFromDb.length === 0) {
            return NextResponse.json([]);
        }

        const users = usersFromDb.map(fromMongo);
        
        return NextResponse.json(users);
    } catch (error) {
        console.error("Failed to fetch users:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
