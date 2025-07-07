
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/firebase';
import type { AppUser } from '@/lib/types';

export async function GET() {
    const session = await getServerSession(authOptions);
    // Ensure user is authenticated and is an admin or owner
    if (!session?.user?.role || !['admin', 'owner'].includes(session.user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const snapshot = await db.collection('users').orderBy('name', 'asc').get();
        
        if (snapshot.empty) {
            return NextResponse.json([]);
        }

        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
        
        return NextResponse.json(users);
    } catch (error) {
        console.error("Failed to fetch users:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
