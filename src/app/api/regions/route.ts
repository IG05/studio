import { NextResponse } from 'next/server';
import type { Region } from '@/lib/types';

// This data rarely changes, so it's fine to hardcode it here.
const allRegionsDB: Region[] = [
    { id: 'us-east-1', name: 'US East (N. Virginia)' },
    { id: 'us-west-2', name: 'US West (Oregon)' },
    { id: 'eu-west-1', name: 'EU (Ireland)' },
    { id: 'ap-southeast-2', name: 'Asia Pacific (Sydney)' },
];

export async function GET() {
    return NextResponse.json(allRegionsDB);
}
