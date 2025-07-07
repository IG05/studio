import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/firebase';

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    // Ensure user is the owner to change roles
    if (session?.user?.role !== 'owner') {
        return NextResponse.json({ error: 'Forbidden: Only the owner can change user roles.' }, { status: 403 });
    }

    // Admins cannot change their own role
    if (session.user.id === params.id) {
        return NextResponse.json({ error: 'Admins cannot change their own role.' }, { status: 400 });
    }

    try {
        const body = await request.json();
        const { role } = body;

        if (role !== 'ADMIN' && role !== 'USER') {
            return NextResponse.json({ error: 'Invalid role provided.' }, { status: 400 });
        }

        const userRef = db.collection('users').doc(params.id);
        await userRef.update({ role });

        const updatedUserDoc = await userRef.get();
        const updatedUser = { id: updatedUserDoc.id, ...updatedUserDoc.data() };


        return NextResponse.json(updatedUser);

    } catch (error) {
        console.error("Failed to update user role:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
