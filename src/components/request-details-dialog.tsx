"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from '@/components/ui/badge';
import type { AccessRequest } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { User, Calendar, Clock, Lock, Unlock, ShieldQuestion, Ban, CheckCircle, Loader2, MessageSquareQuote } from 'lucide-react';

interface RequestDetailsDialogProps {
  request: AccessRequest | null;
  isLoading?: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const formatDisplayDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    try {
        return format(parseISO(dateString), 'PPpp');
    } catch {
        return 'Invalid Date';
    }
}

const getStatusInfo = (req: AccessRequest) => {
    switch (req.status) {
        case 'approved':
            return {
                icon: <Unlock className="h-5 w-5 text-green-500" />,
                text: 'Approved',
                badge: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
            };
        case 'denied':
            return {
                icon: <Lock className="h-5 w-5 text-red-500" />,
                text: 'Denied',
                badge: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
            };
        case 'pending':
        default:
            return {
                icon: <ShieldQuestion className="h-5 w-5 text-yellow-500" />,
                text: 'Pending',
                badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
            };
    }
}

const RequestDetailsContent = ({ request }: { request: AccessRequest }) => {
    const statusInfo = getStatusInfo(request);
    return (
        <div className="grid gap-4 py-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Status</h3>
                <Badge className={statusInfo.badge}>
                    <div className="flex items-center gap-2">
                        {statusInfo.icon}
                        <span>{statusInfo.text}</span>
                    </div>
                </Badge>
            </div>

            <div className="grid gap-2 p-4 border rounded-lg">
                <div className="flex items-start gap-4">
                    <User className="h-5 w-5 mt-1 text-muted-foreground" />
                    <div>
                        <p className="text-sm text-muted-foreground">Requesting User</p>
                        <div className="flex items-center gap-2 font-medium">
                            <Avatar className="h-6 w-6">
                                <AvatarImage src={request.userImage || ''} alt={request.userName || ''} />
                                <AvatarFallback>{request.userName?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span>{request.userName} ({request.userEmail})</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-start gap-4">
                    <Calendar className="h-5 w-5 mt-1 text-muted-foreground" />
                    <div>
                        <p className="text-sm text-muted-foreground">Requested At</p>
                        <p className="font-medium">{formatDisplayDate(request.requestedAt)}</p>
                    </div>
                </div>

                <div className="flex items-start gap-4">
                    <MessageSquareQuote className="h-5 w-5 mt-1 text-muted-foreground" />
                    <div>
                        <p className="text-sm text-muted-foreground">User's Justification</p>
                        <p className="font-medium">{request.reason}</p>
                    </div>
                </div>
            </div>

            {request.status === 'approved' && (
                <div className="grid gap-2 p-4 border rounded-lg bg-green-50 dark:bg-green-900/20">
                    <div className="flex items-start gap-4">
                        <CheckCircle className="h-5 w-5 mt-1 text-green-600 dark:text-green-400" />
                        <div>
                            <p className="text-sm text-muted-foreground">Approved By</p>
                            <p className="font-medium">{request.approvedByUserEmail}</p>
                            <p className="text-xs text-muted-foreground">{formatDisplayDate(request.approvedAt)}</p>
                        </div>
                    </div>
                    {request.approvalReason && (
                        <div className="flex items-start gap-4">
                            <MessageSquareQuote className="h-5 w-5 mt-1 text-green-600 dark:text-green-400" />
                            <div>
                                <p className="text-sm text-muted-foreground">Approver's Reason</p>
                                <p className="font-medium">{request.approvalReason}</p>
                            </div>
                        </div>
                    )}
                    <div className="flex items-start gap-4">
                        <Clock className="h-5 w-5 mt-1 text-green-600 dark:text-green-400" />
                        <div>
                            <p className="text-sm text-muted-foreground">Access Expires At</p>
                            <p className="font-medium">{formatDisplayDate(request.expiresAt)}</p>
                        </div>
                    </div>
                </div>
            )}
            {request.status === 'denied' && (
                <div className="grid gap-2 p-4 border rounded-lg bg-red-50 dark:bg-red-900/20">
                    <div className="flex items-start gap-4">
                        <Ban className="h-5 w-5 mt-1 text-red-600 dark:text-red-400" />
                        <div>
                            <p className="text-sm text-muted-foreground">Denial Reason</p>
                            <p className="font-medium">{request.denialReason || "No reason provided."}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


export function RequestDetailsDialog({ request, isLoading, onOpenChange }: RequestDetailsDialogProps) {
  const isOpen = !!request;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isLoading || !request ? 'Loading Request...' : 'Request Details'}</DialogTitle>
          {!isLoading && request && (
            <DialogDescription>
              Detailed information for access request to <strong>{request.bucketName}</strong>.
            </DialogDescription>
          )}
        </DialogHeader>
        
        {isLoading || !request ? (
            <div className="flex justify-center items-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        ) : (
            <RequestDetailsContent request={request} />
        )}
      </DialogContent>
    </Dialog>
  );
}
