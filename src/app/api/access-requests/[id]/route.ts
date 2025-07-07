
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/lib/firebase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import admin from 'firebase-admin';

// Helper to convert Firestore Timestamps to ISO strings
const convertTimestamps = (docData: admin.firestore.DocumentData) => {
    const data = { ...docData };
    for (const key in data) {
        if (data[key] instanceof admin.firestore.Timestamp) {
            data[key] = data[key].toDate().toISOString();
        }
    }
    return data;
};

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.role || !['admin', 'owner'].includes(session.user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = params;
    const body = await request.json();
    const { status, denialReason } = body;

    if (status !== 'approved' && status !== 'denied') {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    if (status === 'denied' && !denialReason) {
        return NextResponse.json({ error: 'Denial reason is required' }, { status: 400 });
    }

    try {
        const requestRef = db.collection('accessRequests').doc(id);
        
        const updateData: { status: 'approved' | 'denied', denialReason?: string | null } = { status, denialReason: denialReason || null };
        if (status === 'approved') {
            delete updateData.denialReason;
        }

        await requestRef.update(updateData);
        
        const updatedDoc = await requestRef.get();
        if (!updatedDoc.exists) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }
        
        const responseData = { id: updatedDoc.id, ...convertTimestamps(updatedDoc.data()!) };

        return NextResponse.json(responseData);

    } catch (error) {
        console.error("Failed to update access request:", error);
        // Basic error check, Firestore errors are different from Prisma's
        if (error instanceof Error && error.message.includes("NOT_FOUND")) {
             return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
