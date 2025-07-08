
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import type { NextRequest } from 'next/server';
import { connectToDatabase, fromMongo } from '@/lib/mongodb';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.role) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        const { db } = await connectToDatabase();
        let query = {};
        
        // Admin or owner sees all requests.
        if (!['admin', 'owner'].includes(session.user.role)) {
            // User sees only their own requests.
            query = { userId: session.user.id };
        }

        const requestsCursor = db.collection('accessRequests').find(query).sort({ requestedAt: -1 });
        const requestsFromDb = await requestsCursor.toArray();
        
        if (requestsFromDb.length === 0) {
            return NextResponse.json([]);
        }

        const requests = requestsFromDb.map(fromMongo);
        
        return NextResponse.json(requests);

    } catch (error) {
        console.error("Failed to fetch access requests from MongoDB:", error);
        return NextResponse.json({ error: 'Database error: Could not fetch access requests.' }, { status: 500 });
    }
}


export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { bucketName, region, reason, durationInMinutes } = body;

        if (!bucketName || !region || !reason || typeof durationInMinutes !== 'number') {
            return NextResponse.json({ error: 'Missing or invalid required fields' }, { status: 400 });
        }
        
        // 1 year = 365 * 24 * 60 = 525600 minutes
        if (durationInMinutes < 15 || durationInMinutes > 525600) {
            return NextResponse.json({ error: 'Duration must be between 15 minutes and 1 year.' }, { status: 400 });
        }

        const newRequestData = {
            bucketName,
            region,
            reason,
            durationInMinutes,
            status: 'pending',
            expiresAt: null,
            requestedAt: new Date(),
            // Denormalize user data for easier access
            userId: session.user.id,
            userName: session.user.name,
            userEmail: session.user.email,
            userImage: session.user.image,
            denialReason: null,
        };

        const { db } = await connectToDatabase();
        const result = await db.collection('accessRequests').insertOne(newRequestData);

        const newRequest = { ...newRequestData, _id: result.insertedId };
        
        return NextResponse.json(fromMongo(newRequest), { status: 201 });
    
    } catch (error) {
        console.error("Failed to create access request:", error);
        return NextResponse.json({ error: 'Database error: Could not create access request.' }, { status: 500 });
    }
}
