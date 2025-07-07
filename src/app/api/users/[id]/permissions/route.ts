
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';

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
        
        await db.collection('permissions').updateOne(
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

        return NextResponse.json({ success: true, buckets });
    } catch (error) {
        console.error("Failed to update user permissions:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
