
"use client";

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { AppUser, AllUserPermissions } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { Loader2, KeyRound, Timer, ShieldCheck, HardDrive, Info, Edit, Trash2, Globe, CheckCircle, XCircle } from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';

interface UserAccessDetailsDialogProps {
  user: AppUser | null;
  onOpenChange: (isOpen: boolean) => void;
}

export function UserAccessDetailsDialog({ user, onOpenChange }: UserAccessDetailsDialogProps) {
  const [permissions, setPermissions] = useState<AllUserPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isOpen = !!user;
  
  const isPrivilegedUser = user?.role === 'ADMIN' || user?.role === 'OWNER';

  useEffect(() => {
    if (user && !isPrivilegedUser) {
      setIsLoading(true);
      fetch(`/api/users/${user.id}/all-permissions`)
        .then(res => {
          if (!res.ok) throw res.json();
          return res.json();
        })
        .then(data => {
          setPermissions(data);
        })
        .catch(async err => {
          const error = await err;
          console.error("Failed to fetch user permissions", error);
          toast({
            title: "Error",
            description: error.error || "Could not fetch user permissions.",
            variant: "destructive",
          });
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setPermissions(null);
      setIsLoading(false);
    }
  }, [user, isPrivilegedUser]);

  const renderContent = () => {
    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (isPrivilegedUser) {
        return (
            <div className="text-center text-muted-foreground py-10 px-4 flex flex-col items-center gap-4">
              <Info className="h-10 w-10 text-blue-500" />
              <p className="font-semibold text-foreground">
                As an {user?.role.toLowerCase()}, this user has unrestricted access to all S3 buckets.
              </p>
              <p className="text-sm">Their permissions are inherent to their role and are not listed individually.</p>
            </div>
        );
    }

    const permanent = permissions?.permanent;
    const temporary = permissions?.temporary;
    const hasPermanent = permanent && (permanent.write.access !== 'none' || permanent.canDelete);
    const hasTemporary = temporary && temporary.length > 0;

    if (!hasPermanent && !hasTemporary) {
        return (
            <div className="text-center text-muted-foreground py-10">
              This user has no assigned permissions.
            </div>
        );
    }

    return (
        <div className="space-y-6 py-2">
          {/* Permanent Permissions */}
          {hasPermanent && permanent && (
            <div>
              <h3 className="font-semibold flex items-center gap-2 mb-2"><ShieldCheck className="h-5 w-5 text-primary" /> Permanent Permissions</h3>
              <div className="space-y-4 p-4 border rounded-lg">
                {/* Write Access */}
                <div className="flex items-start gap-3">
                  <Edit className="h-5 w-5 mt-0.5 text-muted-foreground" />
                  <div>
                    <h4 className="font-medium">Write Access</h4>
                    {permanent.write.access === 'none' && <p className="text-sm text-muted-foreground">No permanent write access.</p>}
                    {permanent.write.access === 'all' && (
                      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                        <Globe className="h-4 w-4" /> <span>All Buckets</span>
                      </div>
                    )}
                    {permanent.write.access === 'selective' && (
                      <div className="text-sm">
                        <p className="text-muted-foreground mb-1">Selective access to:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {permanent.write.buckets.map(bucket => <li key={bucket}>{bucket}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Delete Access */}
                <div className="flex items-start gap-3">
                  <Trash2 className="h-5 w-5 mt-0.5 text-muted-foreground" />
                  <div>
                    <h4 className="font-medium">Delete Permission</h4>
                    <div className={`flex items-center gap-2 text-sm ${permanent.canDelete ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {permanent.canDelete ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      <span>{permanent.canDelete ? 'Enabled' : 'Disabled'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Temporary Permissions */}
          {hasTemporary && temporary && (
            <div>
              <h3 className="font-semibold flex items-center gap-2 mb-2"><Timer className="h-5 w-5 text-orange-500" /> Temporary Access</h3>
              <div className="space-y-2 p-3 border rounded-lg">
                {temporary.map(access => (
                  <div key={access.bucketName} className="flex items-center justify-between text-sm p-2 rounded-md hover:bg-muted/50">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{access.bucketName}</div>
                        {access.region && <div className="text-xs text-muted-foreground">{access.region}</div>}
                      </div>
                    </div>
                    <Badge variant="outline">
                      {access.expiresAt ? `expires ${formatDistanceToNow(parseISO(access.expiresAt), { addSuffix: true })}` : 'Never'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md flex flex-col max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound />
            User Permissions
          </DialogTitle>
          {user && (
            <DialogDescription>
              Showing all access for <span className="font-semibold">{user.name}</span>.
            </DialogDescription>
          )}
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto -mr-6 pr-6">
            {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
