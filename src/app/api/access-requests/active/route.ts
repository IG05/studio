
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase, fromMongo } from '@/lib/mongodb';
import { isAfter } from 'date-fns';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.role || !['admin', 'owner'].includes(session.user.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        const { db } = await connectToDatabase();
        
        // Find requests that are approved and have an expiration date in the future.
        const query = {
            status: 'approved',
            expiresAt: { $exists: true, $ne: null, $gt: new Date() }
        };

        const requestsCursor = db.collection('accessRequests').find(query).sort({ expiresAt: 1 });
        const requestsFromDb = await requestsCursor.toArray();
        
        if (requestsFromDb.length === 0) {
            return NextResponse.json([]);
        }

        const requests = requestsFromDb.map(fromMongo);
        
        return NextResponse.json(requests);

    } catch (error) {
        console.error("Failed to fetch active access requests from MongoDB:", error);
        return NextResponse.json({ error: 'Database error: Could not fetch active access requests.' }, { status: 500 });
    }
}
