
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/header';
import type { AccessRequest, AppUser, AuditLog } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, MoreVertical, ShieldCheck, User as UserIcon, Check, KeyRound, Crown, Search, FileCheck, UserCog, Eye } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
  } from "@/components/ui/tabs";
import { Skeleton } from '@/components/ui/skeleton';
import { DenyRequestDialog } from '@/components/deny-request-dialog';
import { ApproveRequestDialog } from '@/components/approve-request-dialog';
import { ChangeRoleDialog } from '@/components/change-role-dialog';
import { useSession } from 'next-auth/react';
import { AssignBucketsDialog } from '@/components/assign-buckets-dialog';
import { Input } from '@/components/ui/input';
import { RequestDetailsDialog } from '@/components/request-details-dialog';

export default function AdminPage() {
  const [requests, setRequests] = React.useState<AccessRequest[]>([]);
  const [users, setUsers] = React.useState<AppUser[]>([]);
  const [logs, setLogs] = React.useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('pending');
  const [denialCandidate, setDenialCandidate] = React.useState<AccessRequest | null>(null);
  const [approvalCandidate, setApprovalCandidate] = React.useState<AccessRequest | null>(null);
  const [roleChangeCandidate, setRoleChangeCandidate] = React.useState<{ user: AppUser; role: 'ADMIN' | 'USER' } | null>(null);
  const [permissionUser, setPermissionUser] = React.useState<AppUser | null>(null);
  const [userSearchQuery, setUserSearchQuery] = React.useState('');
  const [viewingRequest, setViewingRequest] = React.useState<AccessRequest | null>(null);
  const [isDialogLoading, setIsDialogLoading] = React.useState(false);

  const fetchAllData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [requestsRes, usersRes, logsRes] = await Promise.all([
        fetch('/api/access-requests'),
        fetch('/api/users'),
        fetch('/api/audit-logs'),
      ]);

      const requestsData = await requestsRes.json();
      const usersData = await usersRes.json();
      const logsData = await logsRes.json();
      
      if (!requestsRes.ok) throw new Error(requestsData.error || 'Failed to fetch access requests.');
      if (!usersRes.ok) throw new Error(usersData.error || 'Failed to fetch users.');
      if (!logsRes.ok) throw new Error(logsData.error || 'Failed to fetch logs.');

      setRequests(Array.isArray(requestsData) ? requestsData : []);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setLogs(Array.isArray(logsData) ? logsData : []);

    } catch (err: any) {
      console.error("Failed to fetch admin data", err);
      setRequests([]);
      setUsers([]);
      setLogs([]);
      toast({
        title: 'Error',
        description: err.message || 'Could not fetch admin data.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleRequest = (requestId: string, status: 'approved' | 'denied', reason: string) => {
    fetch(`/api/access-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason }),
    })
    .then(res => {
        if (!res.ok) throw res.json();
        return res.json();
    })
    .then(updatedRequest => {
        toast({
            title: `Request ${status}`,
            description: `The access request has been successfully ${status}.`,
        });
        fetchAllData(); // Refetch all data to ensure consistency
    })
    .catch(async (err) => {
        const error = await err;
        toast({
            title: 'Error',
            description: error.error || 'Failed to update access request.',
            variant: 'destructive',
        });
    });
  };

  const handleViewDetails = async (requestId?: string) => {
    if (!requestId) return;
    setIsDialogLoading(true);
    setViewingRequest({ id: requestId } as AccessRequest); // Open dialog with loading state
    try {
        const res = await fetch(`/api/access-requests/${requestId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to fetch request details.");
        setViewingRequest(data);
    } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
        setViewingRequest(null); // Close dialog on error
    } finally {
        setIsDialogLoading(false);
    }
  };
  
  const handleRoleChange = (userId: string, role: string, reason: string) => {
    fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, reason }),
    })
    .then(res => {
        if (!res.ok) throw res.json();
        return res.json();
    })
    .then(updatedUser => {
        toast({
            title: 'User Updated',
            description: `User role has been successfully changed to ${role}.`,
        });
        fetchAllData(); // Refetch all data
    })
    .catch(async (err) => {
        const error = await err;
        toast({
            title: 'Error',
            description: error.error || 'Failed to update user role.',
            variant: 'destructive',
        });
    });
  }

  const handlePermissionsChange = () => {
    fetchAllData();
  };

  const filteredRequests = requests.filter(req => req.status === 'pending');

  const filteredUsers = React.useMemo(() => {
    if (!userSearchQuery) return users;
    return users.filter(user =>
      (user.name?.toLowerCase() || '').includes(userSearchQuery.toLowerCase()) ||
      (user.email?.toLowerCase() || '').includes(userSearchQuery.toLowerCase())
    );
  }, [users, userSearchQuery]);

  return (
    <>
      <DenyRequestDialog
        request={denialCandidate}
        onOpenChange={(isOpen) => !isOpen && setDenialCandidate(null)}
        onConfirm={(reason) => { if(denialCandidate) { handleRequest(denialCandidate.id, 'denied', reason) }}}
       />
      <ApproveRequestDialog
        request={approvalCandidate}
        onOpenChange={(isOpen) => !isOpen && setApprovalCandidate(null)}
        onConfirm={(reason) => { if(approvalCandidate) { handleRequest(approvalCandidate.id, 'approved', reason) }}}
      />
      <ChangeRoleDialog
        candidate={roleChangeCandidate}
        onOpenChange={(isOpen) => !isOpen && setRoleChangeCandidate(null)}
        onConfirm={(reason) => { if(roleChangeCandidate) { handleRoleChange(roleChangeCandidate.user.id, roleChangeCandidate.role, reason) }}}
      />
       <RequestDetailsDialog
        request={viewingRequest}
        isLoading={isDialogLoading}
        onOpenChange={(isOpen) => !isOpen && setViewingRequest(null)}
       />
       <AssignBucketsDialog
        user={permissionUser}
        onOpenChange={(isOpen) => !isOpen && setPermissionUser(null)}
        onPermissionsChanged={handlePermissionsChange}
       />
      <div className="flex flex-col h-full w-full">
        <Header title="Admin Dashboard" />
          <div className="p-4 md:p-6 flex-1 overflow-y-auto">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="mb-4">
                      <TabsTrigger value="pending">Pending Requests</TabsTrigger>
                      <TabsTrigger value="logs">Access Logs</TabsTrigger>
                      <TabsTrigger value="users">User Management</TabsTrigger>
                  </TabsList>
                  <TabsContent value="pending">
                      <RequestsTable requests={filteredRequests} handleApprove={setApprovalCandidate} handleDeny={setDenialCandidate} isLoading={isLoading} />
                  </TabsContent>
                  <TabsContent value="logs">
                      <LogsTable logs={logs} isLoading={isLoading} onViewDetails={handleViewDetails} />
                  </TabsContent>
                  <TabsContent value="users">
                    <div className="flex justify-end mb-4">
                      <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search by name or email..." className="pl-9" value={userSearchQuery} onChange={(e) => setUserSearchQuery(e.target.value)} />
                      </div>
                    </div>
                      <UsersTable users={filteredUsers} onRoleChange={(user, role) => setRoleChangeCandidate({ user, role })} onAssignBuckets={setPermissionUser} isLoading={isLoading} />
                  </TabsContent>
              </Tabs>
          </div>
      </div>
    </>
  );
}

const RequestsTable = ({ requests, handleApprove, handleDeny, isLoading }: { requests: AccessRequest[], handleApprove: (req: AccessRequest) => void, handleDeny: (req: AccessRequest) => void, isLoading: boolean }) => (
    <div className="border rounded-lg">
        <Table>
            <TableHeader>
            <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Bucket</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead className="text-right">Actions</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (<TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>))
            ) : requests.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center">No pending requests.</TableCell></TableRow>
            ) : requests.map((req) => (
                <TableRow key={req.id}>
                <TableCell>
                    <div className="flex items-center gap-3">
                    <Avatar><AvatarImage src={req.userImage || ''} alt={req.userName || ''} /><AvatarFallback>{req.userName?.charAt(0)}</AvatarFallback></Avatar>
                    <div><div className="font-medium">{req.userName}</div><div className="text-sm text-muted-foreground">{req.userEmail}</div></div>
                    </div>
                </TableCell>
                <TableCell><div className="font-medium">{req.bucketName}</div><div className="text-sm text-muted-foreground">{req.region}</div></TableCell>
                <TableCell className="max-w-xs truncate">{req.reason}</TableCell>
                <TableCell>{req.durationInMinutes} minutes</TableCell>
                <TableCell>
                    <div className="font-medium">{format(parseISO(req.requestedAt), 'PP')}</div>
                    <div className="text-sm text-muted-foreground">{format(parseISO(req.requestedAt), 'p')}</div>
                </TableCell>
                <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="icon" className="text-green-600 hover:text-green-600 hover:bg-green-100 dark:hover:bg-green-900/50" onClick={() => handleApprove(req)}><CheckCircle className="h-5 w-5" /></Button>
                        <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50" onClick={() => handleDeny(req)}><XCircle className="h-5 w-5" /></Button>
                    </div>
                </TableCell>
                </TableRow>
            ))}
            </TableBody>
        </Table>
    </div>
);

const LogsTable = ({ logs, isLoading, onViewDetails }: { logs: AuditLog[], isLoading: boolean, onViewDetails: (requestId?: string) => void }) => {
    const renderEventIcon = (type: AuditLog['eventType']) => {
        switch (type) {
            case 'ACCESS_REQUEST_DECISION': return <FileCheck className="h-5 w-5" />;
            case 'ROLE_CHANGE': return <UserCog className="h-5 w-5 text-blue-500" />;
            case 'PERMISSIONS_CHANGE': return <KeyRound className="h-5 w-5 text-yellow-500" />;
            default: return null;
        }
    };

    const renderDetails = (log: AuditLog) => {
        const reasonHtml = log.details.reason ? <div className="text-xs text-muted-foreground">Reason: {log.details.reason}</div> : null;
        switch (log.eventType) {
            case 'ACCESS_REQUEST_DECISION':
                return (
                    <div>
                        <div>
                            <span className={`font-semibold ${log.details.status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>{log.details.status?.toUpperCase()}</span>
                            <span> access for </span>
                            <span className="font-semibold">{log.target.userEmail || log.target.userName}</span>
                            <span> to bucket </span>
                            <span className="font-semibold">{log.target.bucketName}</span>.
                        </div>
                        {reasonHtml}
                    </div>
                );
            case 'ROLE_CHANGE':
                return (
                    <div>
                        <div>
                            <span>Changed role of </span>
                            <span className="font-semibold">{log.target.userEmail || log.target.userName}</span>
                            <span> from </span>
                            <Badge variant="secondary">{log.details.fromRole}</Badge>
                            <span> to </span>
                            <Badge variant="secondary">{log.details.toRole}</Badge>.
                        </div>
                        {reasonHtml}
                    </div>
                );
            case 'PERMISSIONS_CHANGE':
                return (
                    <div>
                        <div>Updated permanent permissions for <span className="font-semibold">{log.target.userEmail || log.target.userName}</span>.</div>
                        {log.details.addedBuckets && log.details.addedBuckets.length > 0 && <div className="text-xs text-green-600">Added: {log.details.addedBuckets.join(', ')}</div>}
                        {log.details.removedBuckets && log.details.removedBuckets.length > 0 && <div className="text-xs text-red-600">Removed: {log.details.removedBuckets.join(', ')}</div>}
                        {reasonHtml}
                    </div>
                );
            default:
                return <pre className="text-xs">{JSON.stringify(log.details, null, 2)}</pre>;
        }
    };
    
    return (
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead className="w-[50px]">Event</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (<TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell></TableRow>))
                ) : logs.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="h-24 text-center">No logs found.</TableCell></TableRow>
                ) : logs.map((log) => (
                    <TableRow key={log.id}>
                    <TableCell><div className="flex justify-center">{renderEventIcon(log.eventType)}</div></TableCell>
                    <TableCell>{renderDetails(log)}</TableCell>
                    <TableCell>{log.actor.email}</TableCell>
                    <TableCell>
                        <div className="font-medium">{format(parseISO(log.timestamp), 'PP')}</div>
                        <div className="text-sm text-muted-foreground">{format(parseISO(log.timestamp), 'p')}</div>
                    </TableCell>
                    <TableCell className="text-right">
                        {log.eventType === 'ACCESS_REQUEST_DECISION' && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onSelect={() => onViewDetails(log.target.requestId)}>
                                        <Eye className="mr-2 h-4 w-4" /> View Details
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
        </div>
    );
};

const UsersTable = ({ users, onRoleChange, onAssignBuckets, isLoading }: { users: AppUser[], onRoleChange: (user: AppUser, role: 'ADMIN' | 'USER') => void, onAssignBuckets: (user: AppUser) => void, isLoading: boolean }) => {
    const { data: session } = useSession();
    const isOwner = session?.user?.role === 'owner';
    const currentUserRole = session?.user?.role;
    
    return (
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (<TableRow key={i}><TableCell colSpan={3}><Skeleton className="h-8 w-full" /></TableCell></TableRow>))
                    ) : users.length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="h-24 text-center">No users found.</TableCell></TableRow>
                    ) : users.map((user) => (
                        <TableRow key={user.id}>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                <Avatar><AvatarImage src={user.image || ''} alt={user.name || ''} /><AvatarFallback>{user.name?.charAt(0)}</AvatarFallback></Avatar>
                                <div><div className="font-medium">{user.name}</div><div className="text-sm text-muted-foreground">{user.email}</div></div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant={user.role === 'USER' ? 'secondary' : 'default'} className="capitalize">
                                    {user.role === 'OWNER' ? <Crown className="h-4 w-4 mr-1 text-yellow-500" /> : user.role === 'ADMIN' ? <ShieldCheck className="h-4 w-4 mr-1" /> : <UserIcon className="h-4 w-4 mr-1" />}
                                    {user.role ? user.role.toLowerCase() : 'N/A'}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" disabled={user.role === 'OWNER' || user.id === session?.user?.id || (currentUserRole === 'admin' && user.role === 'ADMIN')}>
                                            <MoreVertical className="h-5 w-5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        {isOwner && (
                                            <>
                                                <DropdownMenuItem onClick={() => onRoleChange(user, 'ADMIN')} disabled={user.role === 'ADMIN'}>
                                                    <ShieldCheck className="mr-2 h-4 w-4" /> Make Admin {user.role === 'ADMIN' && <Check className="ml-auto h-4 w-4" />}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => onRoleChange(user, 'USER')} disabled={user.role === 'USER'}>
                                                    <UserIcon className="mr-2 h-4 w-4" /> Make User {user.role === 'USER' && <Check className="ml-auto h-4 w-4" />}
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                        <DropdownMenuItem onClick={() => onAssignBuckets(user)} disabled={user.role === 'OWNER' || (currentUserRole === 'admin' && user.role === 'ADMIN')}>
                                            <KeyRound className="mr-2 h-4 w-4" /> Assign Buckets
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                ))}
                </TableBody>
            </Table>
        </div>
    )
};
