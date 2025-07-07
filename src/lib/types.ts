
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
  id: string; // The Firestore document ID
  bucketName: string;
  region: string;
  reason: string;
  requestedAt: string; // ISO string format
  status: 'pending' | 'approved' | 'denied';
  denialReason?: string | null;
  expiresAt?: string | null; // ISO string format

  // Denormalized user data
  userId: string;
  userName: string | null;
  userEmail: string | null;
  userImage: string | null;
};
