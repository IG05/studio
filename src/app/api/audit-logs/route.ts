
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase, fromMongo, toObjectId } from '@/lib/mongodb';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.role || !['admin', 'owner'].includes(session.user.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const eventTypesParam = searchParams.get('eventTypes');
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const searchQuery = searchParams.get('searchQuery');
    
    try {
        const { db } = await connectToDatabase();
        
        let query: any = {};
        
        if (eventTypesParam) {
            const eventTypes = eventTypesParam.split(',');
            if (eventTypes.length > 0) {
                query.eventType = { $in: eventTypes };
            }
        }

        if (userId) {
            // Find logs where the user is either the actor OR the target
            query.$or = [
                { 'actor.userId': userId },
                { 'target.userId': userId }
            ];
        }

        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) {
                query.timestamp.$gte = new Date(startDate);
            }
            if (endDate) {
                query.timestamp.$lte = new Date(endDate);
            }
        }
        
        if (searchQuery) {
            // Note: For this to be efficient, you need a text index in your MongoDB collection.
            // Example: db.auditLogs.createIndex({ "$**": "text" })
            // As a fallback, this uses regex which is less performant on large datasets.
             query.$or = [
                ...(query.$or || []),
                { 'actor.email': { $regex: searchQuery, $options: 'i' } },
                { 'target.userEmail': { $regex: searchQuery, $options: 'i' } },
                { 'target.userName': { $regex: searchQuery, $options: 'i' } },
                { 'target.bucketName': { $regex: searchQuery, $options: 'i' } },
                { 'target.objectKey': { $regex: searchQuery, $options: 'i' } },
                { 'details.reason': { $regex: searchQuery, $options: 'i' } },
                { 'details.permissionsChangeSummary': { $regex: searchQuery, $options: 'i' } },
            ];
        }
        
        const logsCursor = db.collection('auditLogs').find(query).sort({ timestamp: -1 });
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
