
"use client";

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from '@/components/ui/badge';
import type { AppUser } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { Loader2, KeyRound, Timer, ShieldCheck, HardDrive } from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { ScrollArea } from './ui/scroll-area';

interface UserAccessDetailsDialogProps {
  user: AppUser | null;
  onOpenChange: (isOpen: boolean) => void;
}

type UserPermissions = {
  permanent: string[];
  temporary: {
    bucketName: string;
    region?: string;
    expiresAt: string | null;
  }[];
};

export function UserAccessDetailsDialog({ user, onOpenChange }: UserAccessDetailsDialogProps) {
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isOpen = !!user;

  useEffect(() => {
    if (user) {
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
    }
  }, [user]);

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
          {isLoading ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !permissions || (!permissions.permanent.length && !permissions.temporary.length) ? (
            <div className="text-center text-muted-foreground py-10">
              This user has no assigned permissions.
            </div>
          ) : (
            <div className="space-y-6 py-2">
              {permissions.permanent.length > 0 && (
                <div>
                  <h3 className="font-semibold flex items-center gap-2 mb-2"><ShieldCheck className="h-4 w-4 text-green-500" /> Permanent Access</h3>
                  <div className="space-y-2 p-3 border rounded-lg">
                    {permissions.permanent.map(bucketName => (
                      <div key={bucketName} className="flex items-center gap-2 text-sm">
                        <HardDrive className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{bucketName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {permissions.temporary.length > 0 && (
                <div>
                  <h3 className="font-semibold flex items-center gap-2 mb-2"><Timer className="h-4 w-4 text-orange-500" /> Temporary Access</h3>
                  <div className="space-y-2 p-3 border rounded-lg">
                    {permissions.temporary.map(access => (
                      <div key={access.bucketName} className="flex items-center justify-between text-sm">
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
