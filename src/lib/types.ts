
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
  region?: string;
  access: 'read-write' | 'read-only';
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
  status: 'pending' | 'approved' | 'denied' | 'revoked';
  denialReason?: string | null;
  approvalReason?: string | null;
  revocationReason?: string | null;
  expiresAt?: string | null; // ISO string format

  // Denormalized user data
  userId: string;
  userName: string | null;
  userEmail: string | null;
  userImage: string | null;

  // Approval data
  approvedByUserId?: string | null;
  approvedByUserEmail?: string | null;
  approvedAt?: string | null; // ISO string format

  // Denial data
  deniedByUserId?: string | null;
  deniedByUserEmail?: string | null;
  deniedAt?: string | null; // ISO string format

  // Revocation data
  revokedByUserId?: string | null;
  revokedByUserEmail?: string | null;
  revokedAt?: string | null; // ISO string format
};

export type AuditLog = {
  id: string;
  timestamp: string; // ISO string
  eventType: 'ACCESS_REQUEST_DECISION' | 'ROLE_CHANGE' | 'PERMISSIONS_CHANGE' | 'ACCESS_REVOKED' | 'FILE_UPLOAD' | 'FOLDER_CREATE' | 'OBJECT_DELETE' | 'FILE_DOWNLOAD';
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
    objectKey?: string;
  };
  details: {
    status?: 'approved' | 'denied' | 'revoked';
    reason?: string;
    fromRole?: 'OWNER' | 'ADMIN' | 'USER';
    toRole?: 'OWNER' | 'ADMIN' | 'USER';
    permissionsChangeSummary?: string;
    [key: string]: any; // for extra details on file ops
  };
};

export type UserPermissions = {
  write: {
    access: 'all' | 'selective' | 'none';
    buckets: string[];
  };
  canDelete: boolean;
};

export type AllUserPermissions = {
  permanent: UserPermissions;
  temporary: {
    bucketName: string;
    region?: string;
    expiresAt: string | null;
  }[];
};
