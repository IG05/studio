
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import type { NextRequest } from 'next/server';
import { db } from '@/lib/firebase';
import { add } from 'date-fns';
import type { AccessRequest } from '@/lib/types';
import admin from 'firebase-admin';

// Helper to convert Firestore Timestamps to ISO strings
const convertTimestamps = (docData: admin.firestore.DocumentData) => {
    const data = { ...docData };
    for (const key in data) {
        if (data[key] instanceof admin.firestore.Timestamp) {
            data[key] = data[key].toDate().toISOString();
        }
    }
    return data;
};

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.role) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        let snapshot;
        
        // Admin or owner sees all requests, sorted by date
        if (['admin', 'owner'].includes(session.user.role)) {
            snapshot = await db.collection('accessRequests').orderBy('requestedAt', 'desc').get();
        } else {
            // User sees only their own requests. We sort them in code to avoid needing a composite index.
            snapshot = await db.collection('accessRequests').where('userId', '==', session.user.id).get();
        }

        if (snapshot.empty) {
            return NextResponse.json([]);
        }

        let requests = snapshot.docs.map(doc => {
            const data = convertTimestamps(doc.data());
            return { id: doc.id, ...data } as AccessRequest;
        });

        // If user is not admin/owner, sort here. The admin list is already sorted by the query.
        if (!['admin', 'owner'].includes(session.user.role)) {
            requests.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
        }
        
        return NextResponse.json(requests);

    } catch (error) {
        console.error("Failed to fetch access requests from Firestore:", error);
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
        
        if (durationInMinutes < 15 || durationInMinutes > 720) {
            return NextResponse.json({ error: 'Duration must be between 15 and 720 minutes.' }, { status: 400 });
        }

        const expiresAt = add(new Date(), { minutes: durationInMinutes });
        const requestedAt = new Date();

        const newRequestData = {
            bucketName,
            region,
            reason,
            status: 'pending',
            expiresAt,
            requestedAt,
            // Denormalize user data for easier access
            userId: session.user.id,
            userName: session.user.name,
            userEmail: session.user.email,
            userImage: session.user.image,
            denialReason: null,
        };

        const docRef = await db.collection('accessRequests').add(newRequestData);
        
        const newRequest = { id: docRef.id, ...newRequestData };
        // Convert dates to ISO strings for the response
        const responseRequest = {
            ...newRequest,
            expiresAt: newRequest.expiresAt.toISOString(),
            requestedAt: newRequest.requestedAt.toISOString(),
        };

        return NextResponse.json(responseRequest, { status: 201 });
    
    } catch (error) {
        console.error("Failed to create access request:", error);
        return NextResponse.json({ error: 'Database error: Could not create access request.' }, { status: 500 });
    }
}
