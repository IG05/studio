
import type { User as NextAuthUser } from 'next-auth';

export type S3CommanderUser = NextAuthUser & {
  role: 'owner' | 'admin' | 'user';
};

// Represents a user document in Firestore
export type AppUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: 'OWNER' | 'ADMIN' | 'USER';
}

export type Region = {
    id: string;
    name: string;
}

export type Bucket = {
  name: string;
  region: string;
  access: 'full' | 'limited' | 'none';
  tempAccessExpiresAt?: string;
  size?: number;
};

export type S3Object = {
  key: string;
  type: 'folder' | 'file';
  size?: number;
  lastModified: string;
};

// This type now reflects a document in the 'accessRequests' Firestore collection.
export type AccessRequest = {
  id: string; // The document ID
  bucketName: string;
  region: string;
  reason: string;
  durationInMinutes: number;
  requestedAt: string; // ISO string format
  status: 'pending' | 'approved' | 'denied';
  denialReason?: string | null;
  expiresAt?: string | null; // ISO string format

  // Denormalized user data
  userId: string;
  userName: string | null;
  userEmail: string | null;
  userImage: string | null;

  // Approval data
  approvedByUserId?: string | null;
  approvedByUserEmail?: string | null;
  approvedByUserName?: string | null;
  approvedAt?: string | null; // ISO string format
};

export type AuditLog = {
  id: string;
  timestamp: string; // ISO string
  eventType: 'ACCESS_REQUEST_DECISION' | 'ROLE_CHANGE' | 'PERMISSIONS_CHANGE';
  actor: {
    userId: string;
    email: string | null;
  };
  target: {
    userId?: string;
    userName?: string | null;
    userEmail?: string | null;
    bucketName?: string;
    requestId?: string;
  };
  details: {
    status?: 'approved' | 'denied';
    denialReason?: string | null;
    fromRole?: 'OWNER' | 'ADMIN' | 'USER';
    toRole?: 'OWNER' | 'ADMIN' | 'USER';
    addedBuckets?: string[];
    removedBuckets?: string[];
  };
};
