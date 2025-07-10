
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase, fromMongo, toObjectId } from '@/lib/mongodb';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const eventTypesParam = searchParams.get('eventTypes');
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const searchQuery = searchParams.get('searchQuery');

    // Security Check: Admins/Owners can query anything. Users can only query their own logs.
    const isAdminOrOwner = ['admin', 'owner'].includes(session.user.role!);
    if (!isAdminOrOwner && userId !== session.user.id) {
         return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    try {
        const { db } = await connectToDatabase();
        
        let query: any = {};
        let finalQuery: any = {};
        
        const textSearchConditions: any[] = [];
        if (searchQuery) {
            const regex = { $regex: searchQuery, $options: 'i' };
            textSearchConditions.push(
                { 'actor.email': regex },
                { 'target.userEmail': regex },
                { 'target.userName': regex },
                { 'target.bucketName': regex },
                { 'target.objectKey': regex },
                { 'details.reason': regex },
                { 'details.permissionsChangeSummary': regex },
            );
        }

        const filterConditions: any[] = [];
        if (eventTypesParam) {
            const eventTypes = eventTypesParam.split(',');
            if (eventTypes.length > 0) {
                filterConditions.push({ eventType: { $in: eventTypes } });
            }
        }

        if (userId) {
            // Find logs where the user is either the actor OR the target
            filterConditions.push({ 
                $or: [
                    { 'actor.userId': userId },
                    { 'target.userId': userId }
                ]
            });
        }

        if (startDate || endDate) {
            const timestampFilter: any = {};
            if (startDate) {
                timestampFilter.$gte = new Date(startDate);
            }
            if (endDate) {
                timestampFilter.$lte = new Date(endDate);
            }
            filterConditions.push({ timestamp: timestampFilter });
        }
        
        // Combine all conditions
        if (filterConditions.length > 0) {
            query.$and = filterConditions;
        }

        if (textSearchConditions.length > 0) {
            if (query.$and) {
                // If there are other filters, combine with text search
                finalQuery = { $and: [query, { $or: textSearchConditions }] };
            } else {
                // If only text search is present
                finalQuery = { $or: textSearchConditions };
            }
        } else {
            finalQuery = query;
        }

        const logsCursor = db.collection('auditLogs').find(finalQuery).sort({ timestamp: -1 });
        const logsFromDb = await logsCursor.toArray();
        
        if (logsFromDb.length === 0) {
            return NextResponse.json([]);
        }

        const logs = logsFromDb.map(fromMongo);
        
        return NextResponse.json(logs);

    } catch (error) {
        console.error("Failed to fetch audit logs from MongoDB:", error);
        return NextResponse.json({ error: 'Database error: Could not fetch audit logs.' }, { status: 500 });
    }
}
