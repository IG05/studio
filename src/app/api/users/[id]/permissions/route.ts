
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/firebase';

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
        const permDoc = await db.collection('permissions').doc(userId).get();
        if (!permDoc.exists) {
            return NextResponse.json({ buckets: [] });
        }
        return NextResponse.json(permDoc.data());
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
        const permRef = db.collection('permissions').doc(userId);
        await permRef.set({
            userId: userId,
            buckets: buckets,
            updatedAt: new Date().toISOString(),
            updatedBy: session.user.id,
        }, { merge: true });

        return NextResponse.json({ success: true, buckets });
    } catch (error) {
        console.error("Failed to update user permissions:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
