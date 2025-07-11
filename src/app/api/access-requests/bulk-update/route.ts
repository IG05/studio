
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase, toObjectId } from '@/lib/mongodb';
import { add } from 'date-fns';

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.role || !['admin', 'owner'].includes(session.user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let { requestIds, status, reason } = await request.json();

    if (!Array.isArray(requestIds) || requestIds.length === 0) {
        return NextResponse.json({ error: 'Request IDs must be a non-empty array' }, { status: 400 });
    }
    if (!['approved', 'denied'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status provided' }, { status: 400 });
    }
    if (status === 'denied' && (!reason || typeof reason !== 'string' || reason.length < 10)) {
        return NextResponse.json({ error: 'A reason of at least 10 characters is required for denial.' }, { status: 400 });
    }

    if (status === 'approved' && !reason) {
        reason = "Request approved by administrator in bulk.";
    }

    const objectIds = requestIds.map(toObjectId).filter(id => id !== null) as import('mongodb').ObjectId[];
    
    if (objectIds.length !== requestIds.length) {
        return NextResponse.json({ error: 'One or more invalid request ID formats provided.' }, { status: 400 });
    }

    try {
        const { db } = await connectToDatabase();
        const accessRequestsCollection = db.collection('accessRequests');

        const requestsToUpdate = await accessRequestsCollection.find({ _id: { $in: objectIds }, status: 'pending' }).toArray();

        if (requestsToUpdate.length === 0) {
            return NextResponse.json({
                successCount: 0,
                errorCount: 0,
                message: 'No pending requests found for the given IDs.'
            });
        }

        let successCount = 0;
        const logEntries = [];
        const totalToProcess = requestsToUpdate.length;

        for (const req of requestsToUpdate) {
            const updatePayload: any = { $set: { status } };

            if (status === 'approved') {
                updatePayload.$set.expiresAt = add(new Date(), { minutes: req.durationInMinutes });
                updatePayload.$set.approvedAt = new Date();
                updatePayload.$set.approvedByUserId = session.user.id;
                updatePayload.$set.approvedByUserEmail = session.user.email;
                updatePayload.$set.approvalReason = reason;
                updatePayload.$unset = { denialReason: "", deniedAt: "", deniedByUserId: "", deniedByUserEmail: "" };
            } else { // denied
                updatePayload.$set.denialReason = reason;
                updatePayload.$set.deniedAt = new Date();
                updatePayload.$set.deniedByUserId = session.user.id;
                updatePayload.$set.deniedByUserEmail = session.user.email;
                updatePayload.$unset = { approvedAt: "", approvedByUserId: "", approvedByUserEmail: "", expiresAt: "", approvalReason: "" };
            }

            const result = await accessRequestsCollection.updateOne({ _id: req._id }, updatePayload);
            
            if (result.modifiedCount === 1) {
                successCount++;
                logEntries.push({
                    timestamp: new Date(),
                    eventType: 'ACCESS_REQUEST_DECISION',
                    actor: {
                        userId: session.user.id,
                        email: session.user.email,
                    },
                    target: {
                        requestId: req._id.toString(),
                        userId: req.userId,
                        userEmail: req.userEmail,
                        userName: req.userName,
                        bucketName: req.bucketName,
                    },
                    details: {
                        status,
                        reason,
                        isBulk: true,
                        requestCount: totalToProcess
                    }
                });
            }
        }
        
        if (logEntries.length > 0) {
            await db.collection('auditLogs').insertMany(logEntries);
        }

        return NextResponse.json({
            successCount,
            errorCount: totalToProcess - successCount,
        });

    } catch (error) {
        console.error("Failed to perform bulk update on access requests:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
