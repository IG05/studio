
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase, fromMongo } from '@/lib/mongodb';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.role || !['admin', 'owner'].includes(session.user.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        const { db } = await connectToDatabase();
        const logsCursor = db.collection('auditLogs').find({}).sort({ timestamp: -1 });
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
