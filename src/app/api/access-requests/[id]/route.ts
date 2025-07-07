
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
    if (!session?.user?.role || !['admin', 'owner'].includes(session.user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = params;
    const objectId = toObjectId(id);

    if (!objectId) {
        return NextResponse.json({ error: 'Invalid request ID format' }, { status: 400 });
    }

    const body = await request.json();
    const { status, denialReason } = body;

    if (status !== 'approved' && status !== 'denied') {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    if (status === 'denied' && !denialReason) {
        return NextResponse.json({ error: 'Denial reason is required' }, { status: 400 });
    }

    try {
        const { db } = await connectToDatabase();
        
        const updatePayload: any = { $set: { status } };
        if (status === 'approved') {
            updatePayload.$unset = { denialReason: "" };
            updatePayload.$set.approvedAt = new Date();
            updatePayload.$set.approvedByUserId = session.user.id;
            updatePayload.$set.approvedByUserName = session.user.name;
            updatePayload.$set.approvedByUserEmail = session.user.email;
        } else {
            updatePayload.$set.denialReason = denialReason;
            updatePayload.$unset = { approvedAt: "", approvedByUserId: "", approvedByUserName: "", approvedByUserEmail: "" };
        }
        
        const result = await db.collection('accessRequests').findOneAndUpdate(
            { _id: objectId },
            updatePayload,
            { returnDocument: 'after' }
        );
        
        if (!result) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }
        
        return NextResponse.json(fromMongo(result));

    } catch (error) {
        console.error("Failed to update access request:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
