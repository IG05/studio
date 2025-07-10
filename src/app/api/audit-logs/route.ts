
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
    
    try {
        const { db } = await connectToDatabase();
        
        const query: any = {};
        
        if (eventTypesParam) {
            const eventTypes = eventTypesParam.split(',');
            if (eventTypes.length > 0) {
                query.eventType = { $in: eventTypes };
            }
        }

        if (userId) {
            query['actor.userId'] = userId;
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
