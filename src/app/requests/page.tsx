
"use client";

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/header';
import type { AccessRequest, AuditLog } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
  } from "@/components/ui/tabs";
import { Skeleton } from '@/components/ui/skeleton';
import { Info, MoreVertical, Eye, FileCheck, ShieldOff, UserCog, KeyRound, FileUp, FolderPlus, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { RequestDetailsDialog } from '@/components/request-details-dialog';
import { useSession } from 'next-auth/react';

export default function MyRequestsPage() {
  const [requests, setRequests] = React.useState<AccessRequest[]>([]);
  const [logs, setLogs] = React.useState<AuditLog[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = React.useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('pending');
  const [viewingRequest, setViewingRequest] = React.useState<AccessRequest | null>(null);
  const { data: session } = useSession();


  React.useEffect(() => {
    const fetchRequests = async () => {
        setIsLoadingRequests(true);
        try {
            const res = await fetch('/api/access-requests');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch access requests.');
            setRequests(Array.isArray(data) ? data : []);
        } catch (err: any) {
            console.error("Failed to fetch access requests", err);
            setRequests([]);
            toast({ title: 'Error', description: err.message || 'Could not fetch your access requests.', variant: 'destructive' });
        } finally {
            setIsLoadingRequests(false);
        }
    };
    fetchRequests();
  }, []);

  React.useEffect(() => {
    if (activeTab === 'activity' && session?.user?.id) {
        const fetchLogs = async () => {
            setIsLoadingLogs(true);
            try {
                const params = new URLSearchParams({ userId: session.user.id! });
                const res = await fetch(`/api/audit-logs?${params.toString()}`);
                const data = await res.json();
                if (!res.ok) {
                  const error = await res.json().catch(() => ({error: 'Failed to fetch activity logs.'}));
                  throw new Error(error.error || 'Failed to fetch activity logs.');
                }
                setLogs(Array.isArray(data) ? data.filter(log => ['FILE_UPLOAD', 'FOLDER_CREATE', 'OBJECT_DELETE'].includes(log.eventType)) : []);
            } catch (err: any) {
                console.error("Failed to fetch logs", err);
                setLogs([]);
                toast({ title: 'Error', description: err.message || 'Could not fetch your activity logs.', variant: 'destructive' });
            } finally {
                setIsLoadingLogs(false);
            }
        };
        fetchLogs();
    }
  }, [activeTab, session?.user?.id]);

  const getBadgeVariant = (status: AccessRequest['status']) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
      case 'denied':
        return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
      case 'revoked':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300';
      case 'pending':
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
    }
  };

  const filteredRequests = requests.filter(req => {
    if (activeTab === 'pending') return req.status === 'pending';
    if (activeTab === 'historical') return ['approved', 'denied', 'revoked'].includes(req.status);
    return true;
  });

  return (
    <>
    <RequestDetailsDialog
        request={viewingRequest}
        onOpenChange={(isOpen) => !isOpen && setViewingRequest(null)}
    />
    <div className="flex flex-col h-full w-full">
      <Header title="My Activity" />
        <div className="p-4 md:p-6 flex-1 overflow-y-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue='pending'>
                <TabsList className="mb-4 grid w-full grid-cols-3 h-auto sm:inline-flex sm:w-auto sm:h-10">
                    <TabsTrigger value="pending">Pending Requests</TabsTrigger>
                    <TabsTrigger value="historical">Request History</TabsTrigger>
                    <TabsTrigger value="activity">File Activity</TabsTrigger>
                </TabsList>
                <TabsContent value="pending">
                    <RequestsTable requests={filteredRequests} getBadgeVariant={getBadgeVariant} isLoading={isLoadingRequests} onViewDetails={setViewingRequest} activeTab={activeTab} />
                </TabsContent>
                <TabsContent value="historical">
                    <RequestsTable requests={filteredRequests} getBadgeVariant={getBadgeVariant} isLoading={isLoadingRequests} onViewDetails={setViewingRequest} activeTab={activeTab} />
                </TabsContent>
                 <TabsContent value="activity">
                    <ActivityLogTable logs={logs} isLoading={isLoadingLogs} />
                </TabsContent>
            </Tabs>
        </div>
    </div>
    </>
  );
}

const RequestsTable = ({ requests, getBadgeVariant, isLoading, onViewDetails, activeTab }: { requests: AccessRequest[], getBadgeVariant: (status: AccessRequest['status']) => string, isLoading: boolean, onViewDetails: (req: AccessRequest) => void, activeTab: string }) => (
    <div className="border rounded-lg">
        <Table>
            <TableHeader>
            <TableRow>
                <TableHead>Bucket</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Requested</TableHead>
                {activeTab === 'historical' && <TableHead>Updated</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={activeTab === 'historical' ? 6 : 5}><Skeleton className="h-8 w-full" /></TableCell>
                </TableRow>
              ))
            ) : requests.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={activeTab === 'historical' ? 6 : 5} className="h-24 text-center">You have no requests in this category.</TableCell>
                </TableRow>
            ) : requests.map((req) => {
                const actionDate = req.revokedAt || req.deniedAt || req.approvedAt;
                return (
                    <TableRow key={req.id}>
                        <TableCell>
                            <div className="font-medium">{req.bucketName}</div>
                            <div className="text-sm text-muted-foreground">{req.region}</div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{req.reason}</TableCell>
                        <TableCell>
                            <div className="font-medium">{format(parseISO(req.requestedAt), 'PP')}</div>
                            <div className="text-sm text-muted-foreground">{format(parseISO(req.requestedAt), 'p')}</div>
                        </TableCell>
                        {activeTab === 'historical' && (
                            <TableCell>
                                {actionDate ? (
                                    <>
                                        <div className="font-medium">{format(parseISO(actionDate), 'PP')}</div>
                                        <div className="text-sm text-muted-foreground">{format(parseISO(actionDate), 'p')}</div>
                                    </>
                                ) : (
                                    '--'
                                )}
                            </TableCell>
                        )}
                        <TableCell>
                            <Badge className={getBadgeVariant(req.status)}>{req.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <MoreVertical className="h-5 w-5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onSelect={() => onViewDetails(req)}>
                                        <Eye className="mr-2 h-4 w-4" /> View Details
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>
                )
            })}
            </TableBody>
        </Table>
    </div>
);


const ActivityLogTable = ({ logs, isLoading }: { logs: AuditLog[], isLoading: boolean }) => {
    const renderEventIcon = (type: AuditLog['eventType']) => {
        switch (type) {
            case 'FILE_UPLOAD': return <FileUp className="h-5 w-5 text-green-500" />;
            case 'FOLDER_CREATE': return <FolderPlus className="h-5 w-5 text-green-500" />;
            case 'OBJECT_DELETE': return <Trash2 className="h-5 w-5 text-red-500" />;
            default: return null;
        }
    };

    const renderDetails = (log: AuditLog) => {
        switch (log.eventType) {
            case 'FILE_UPLOAD':
            case 'FOLDER_CREATE':
            case 'OBJECT_DELETE':
                return (
                    <div>
                        <span>{log.eventType === 'FILE_UPLOAD' ? 'Uploaded file' : log.eventType === 'FOLDER_CREATE' ? 'Created folder' : 'Deleted object'} </span>
                        <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">{log.target.objectKey}</span>
                        <span> in bucket </span>
                        <span className="font-semibold">{log.target.bucketName}</span>.
                    </div>
                );
            default:
                return null;
        }
    };
    
    return (
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead className="w-[50px]">Event</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Timestamp</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (<TableRow key={i}><TableCell colSpan={3}><Skeleton className="h-8 w-full" /></TableCell></TableRow>))
                ) : logs.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="h-24 text-center">You have no file activity history.</TableCell></TableRow>
                ) : logs.map((log) => (
                    <TableRow key={log.id}>
                        <TableCell><div className="flex justify-center">{renderEventIcon(log.eventType)}</div></TableCell>
                        <TableCell>{renderDetails(log)}</TableCell>
                        <TableCell>
                            <div className="font-medium">{format(parseISO(log.timestamp), 'PP')}</div>
                            <div className="text-sm text-muted-foreground">{format(parseISO(log.timestamp), 'p')}</div>
                        </TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
        </div>
    );
};
