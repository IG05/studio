
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase, toObjectId, fromMongo } from '@/lib/mongodb';
import { add } from 'date-fns';


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
        
        const requestToUpdate = await db.collection('accessRequests').findOne({ _id: objectId });
        if (!requestToUpdate) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        const updatePayload: any = { $set: { status } };
        
        if (status === 'approved') {
            const durationInMinutes = requestToUpdate.durationInMinutes;
            if (typeof durationInMinutes !== 'number') {
                 return NextResponse.json({ error: 'Request is missing duration information.' }, { status: 400 });
            }

            updatePayload.$set.expiresAt = add(new Date(), { minutes: durationInMinutes });
            updatePayload.$set.approvedAt = new Date();
            updatePayload.$set.approvedByUserId = session.user.id;
            updatePayload.$set.approvedByUserEmail = session.user.email;
            updatePayload.$unset = { denialReason: "", approvedByUserName: "" };

        } else { // status === 'denied'
            updatePayload.$set.denialReason = denialReason;
            updatePayload.$unset = { approvedAt: "", approvedByUserId: "", approvedByUserName: "", approvedByUserEmail: "", expiresAt: "" };
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
