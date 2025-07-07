
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase, toObjectId, fromMongo } from '@/lib/mongodb';
import { add } from 'date-fns';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const objectId = toObjectId(id);

    if (!objectId) {
        return NextResponse.json({ error: 'Invalid request ID format' }, { status: 400 });
    }

    try {
        const { db } = await connectToDatabase();
        const requestDoc = await db.collection('accessRequests').findOne({ _id: objectId });

        if (!requestDoc) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }
        
        // Security check: Admins can see any request, users can only see their own.
        if (session.user.role !== 'admin' && session.user.role !== 'owner' && requestDoc.userId !== session.user.id) {
             return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        
        return NextResponse.json(fromMongo(requestDoc));

    } catch (error) {
        console.error("Failed to fetch access request:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}


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
    const { status, reason } = body;

    if (status !== 'approved' && status !== 'denied') {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    
    if (!reason || typeof reason !== 'string' || reason.length < 10) {
        return NextResponse.json({ error: 'A reason of at least 10 characters is required.' }, { status: 400 });
    }

    try {
        const { db } = await connectToDatabase();
        const accessRequestsCollection = db.collection('accessRequests');
        
        const requestToUpdate = await accessRequestsCollection.findOne({ _id: objectId });
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
            updatePayload.$set.approvalReason = reason;
            updatePayload.$unset = { denialReason: "", deniedAt: "", deniedByUserId: "", deniedByUserEmail: "" };

        } else { // status === 'denied'
            updatePayload.$set.denialReason = reason;
            updatePayload.$set.deniedAt = new Date();
            updatePayload.$set.deniedByUserId = session.user.id;
            updatePayload.$set.deniedByUserEmail = session.user.email;
            updatePayload.$unset = { approvedAt: "", approvedByUserId: "", approvedByUserEmail: "", expiresAt: "", approvalReason: "" };
        }
        
        const result = await accessRequestsCollection.findOneAndUpdate(
            { _id: objectId },
            updatePayload,
            { returnDocument: 'after' }
        );
        
        if (!result) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        // Create an audit log entry for the decision
        const logEntry = {
            timestamp: new Date(),
            eventType: 'ACCESS_REQUEST_DECISION',
            actor: {
              userId: session.user.id,
              email: session.user.email,
            },
            target: {
              requestId: id,
              userId: requestToUpdate.userId,
              userEmail: requestToUpdate.userEmail,
              bucketName: requestToUpdate.bucketName,
            },
            details: {
              status,
              reason,
            }
        };
        await db.collection('auditLogs').insertOne(logEntry);
        
        return NextResponse.json(fromMongo(result));

    } catch (error) {
        console.error("Failed to update access request:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
