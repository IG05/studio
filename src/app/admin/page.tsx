
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
import type { AccessRequest, AppUser, AuditLog, Bucket } from '@/lib/types';
import { format, parseISO, formatDistanceToNow, subDays } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, MoreVertical, ShieldCheck, User as UserIcon, Check, KeyRound, Crown, Search, FileCheck, UserCog, Eye, HardDrive, ShieldOff, Slash, UserRoundCheck, FileUp, FolderPlus, Trash2, CalendarIcon, Filter, FilterX, Plus, Download, Info } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RevokeAccessDialog } from '@/components/revoke-access-dialog';
import { UserAccessDetailsDialog } from '@/components/user-access-details-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import type { DateRange } from 'react-day-picker';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { isEqual } from 'lodash';
import { Checkbox } from '@/components/ui/checkbox';
import { BulkActionDialog } from '@/components/bulk-action-dialog';

const ALL_EVENT_TYPES: AuditLog['eventType'][] = [
    'ACCESS_REQUEST_DECISION',
    'ACCESS_REVOKED',
    'ROLE_CHANGE',
    'PERMISSIONS_CHANGE',
    'FILE_UPLOAD',
    'FILE_DOWNLOAD',
    'FOLDER_CREATE',
    'OBJECT_DELETE'
];

type ActiveFilters = {
    eventType: boolean;
    user: boolean;
    date: boolean;
}

const defaultLogFilters = {
    eventTypes: [] as string[],
    userId: null as string | null,
    dateRange: {
      from: subDays(new Date(), 30),
      to: new Date()
    } as DateRange | undefined,
    searchQuery: '',
};

export default function AdminPage() {
  const { data: session } = useSession();
  const [requests, setRequests] = React.useState<AccessRequest[]>([]);
  const [activeRequests, setActiveRequests] = React.useState<AccessRequest[]>([]);
  const [users, setUsers] = React.useState<AppUser[]>([]);
  const [logs, setLogs] = React.useState<AuditLog[]>([]);
  const [buckets, setBuckets] = React.useState<Bucket[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('pending');
  const [denialCandidate, setDenialCandidate] = React.useState<AccessRequest | null>(null);
  const [approvalCandidate, setApprovalCandidate] = React.useState<AccessRequest | null>(null);
  const [revocationCandidate, setRevocationCandidate] = React.useState<AccessRequest | null>(null);
  const [roleChangeCandidate, setRoleChangeCandidate] = React.useState<{ user: AppUser; role: 'ADMIN' | 'USER' } | null>(null);
  const [permissionUser, setPermissionUser] = React.useState<AppUser | null>(null);
  const [userSearchQuery, setUserSearchQuery] = React.useState('');
  
  const [stagedLogFilters, setStagedLogFilters] = React.useState(defaultLogFilters);
  const [appliedLogFilters, setAppliedLogFilters] = React.useState(defaultLogFilters);

  const [activeFilterInputs, setActiveFilterInputs] = React.useState<ActiveFilters>({
    eventType: false,
    user: false,
    date: false
  });
  
  const [selectedRequestIds, setSelectedRequestIds] = React.useState<string[]>([]);
  const [bulkAction, setBulkAction] = React.useState<'approved' | 'denied' | null>(null);

  const [viewingRequest, setViewingRequest] = React.useState<AccessRequest | null>(null);
  const [viewingUserAccess, setViewingUserAccess] = React.useState<AppUser | null>(null);
  const [isDialogLoading, setIsDialogLoading] = React.useState(false);
  const [isLogsLoading, setIsLogsLoading] = React.useState(true);
  
  const pendingRequests = React.useMemo(() => requests.filter(req => req.status === 'pending'), [requests]);

  const fetchNonLogData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [requestsRes, usersRes, bucketsRes, activeRequestsRes] = await Promise.all([
        fetch('/api/access-requests'),
        fetch('/api/users'),
        fetch('/api/buckets'),
        fetch('/api/access-requests/active'),
      ]);

      const requestsData = await requestsRes.json();
      const usersData = await usersRes.json();
      const bucketsData = await bucketsRes.json();
      const activeRequestsData = await activeRequestsRes.json();
      
      if (!requestsRes.ok) throw new Error(requestsData.error || 'Failed to fetch access requests.');
      if (!usersRes.ok) throw new Error(usersData.error || 'Failed to fetch users.');
      if (!bucketsRes.ok) throw new Error(bucketsData.error || 'Failed to fetch buckets.');
      if (!activeRequestsRes.ok) throw new Error(activeRequestsData.error || 'Failed to fetch active requests.');

      setRequests(Array.isArray(requestsData) ? requestsData : []);
      setActiveRequests(Array.isArray(activeRequestsData) ? activeRequestsData : []);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setBuckets(Array.isArray(bucketsData) ? bucketsData : []);

    } catch (err: any) {
      console.error("Failed to fetch admin data", err);
      setRequests([]);
      setActiveRequests([]);
      setUsers([]);
      setBuckets([]);
      toast({
        title: 'Error',
        description: err.message || 'Could not fetch admin data.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchLogs = React.useCallback(async () => {
    setIsLogsLoading(true);
    try {
      const params = new URLSearchParams();
      if (appliedLogFilters.eventTypes.length > 0) {
        params.append('eventTypes', appliedLogFilters.eventTypes.join(','));
      }
      if (appliedLogFilters.userId) {
        params.append('userId', appliedLogFilters.userId);
      }
      if (appliedLogFilters.dateRange?.from) {
        params.append('startDate', appliedLogFilters.dateRange.from.toISOString());
      }
      if (appliedLogFilters.dateRange?.to) {
        params.append('endDate', appliedLogFilters.dateRange.to.toISOString());
      }
      if (appliedLogFilters.searchQuery) {
        params.append('searchQuery', appliedLogFilters.searchQuery);
      }

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      const logsData = await res.json();
      if (!res.ok) throw new Error(logsData.error || 'Failed to fetch logs.');

      setLogs(Array.isArray(logsData) ? logsData : []);

    } catch(err: any) {
        console.error("Failed to fetch logs", err);
        setLogs([]);
        toast({ title: 'Error', description: err.message || 'Could not fetch audit logs.', variant: 'destructive' });
    } finally {
        setIsLogsLoading(false);
    }
  }, [appliedLogFilters]);

  React.useEffect(() => {
    fetchNonLogData();
  }, [fetchNonLogData]);
  
  React.useEffect(() => {
      fetchLogs();
  }, [fetchLogs]);


  const handleRequest = (requestId: string, status: 'approved' | 'denied' | 'revoked', reason: string) => {
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
        fetchNonLogData(); // Refetch all data to ensure consistency
        fetchLogs(); // refetch logs with current filters
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
  
   const handleBulkUpdateRequest = async (requestIds: string[], status: 'approved' | 'denied', reason: string) => {
    try {
        const res = await fetch('/api/access-requests/bulk-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestIds, status, reason }),
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Bulk update failed');

        toast({
            title: 'Bulk Update Successful',
            description: `${result.successCount} request(s) were successfully ${status}.`,
        });

        if (result.errorCount > 0) {
            toast({
                title: 'Some Requests Failed',
                description: `${result.errorCount} request(s) could not be updated. Check the logs for more details.`,
                variant: 'destructive'
            });
        }
    } catch(err: any) {
        toast({
            title: 'Bulk Update Error',
            description: err.message,
            variant: 'destructive'
        });
    } finally {
        fetchNonLogData();
        fetchLogs();
        setSelectedRequestIds([]); // Clear selection
        setBulkAction(null); // Close the dialog
    }
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
  
  const handleRoleChangeSubmit = (userId: string, role: string, reason: string) => {
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
        fetchNonLogData(); // Refetch all data
        fetchLogs();
        setViewingUserAccess(null); // Close the dialog
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
    fetchNonLogData();
    fetchLogs();
  };
  
  const handleClearFilters = () => {
    setActiveFilterInputs({ eventType: false, user: false, date: false });
    setStagedLogFilters(defaultLogFilters);
    // Apply immediately
    setAppliedLogFilters(defaultLogFilters);
  };
  
  const handleApplyFilters = () => {
    setAppliedLogFilters(stagedLogFilters);
  }

  const handleEditPermissions = (user: AppUser) => {
    setViewingUserAccess(null); // Close the details dialog
    setPermissionUser(user); // Open the permissions dialog
  }

  const filteredUsers = React.useMemo(() => {
    if (!userSearchQuery) return users;
    return users.filter(user =>
      (user.name?.toLowerCase() || '').includes(userSearchQuery.toLowerCase()) ||
      (user.email?.toLowerCase() || '').includes(userSearchQuery.toLowerCase())
    );
  }, [users, userSearchQuery]);

  const adminCount = React.useMemo(() => users.filter(u => u.role === 'ADMIN' || u.role === 'OWNER').length, [users]);
  const standardUserCount = React.useMemo(() => users.filter(u => u.role === 'USER').length, [users]);

  const isAnyFilterInputActive = Object.values(activeFilterInputs).some(v => v);
  const areFiltersStaged = !isEqual(stagedLogFilters, appliedLogFilters);

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
      <RevokeAccessDialog
        request={revocationCandidate}
        onOpenChange={(isOpen) => !isOpen && setRevocationCandidate(null)}
        onConfirm={(reason) => { if(revocationCandidate) { handleRequest(revocationCandidate.id, 'revoked', reason) }}}
      />
      <ChangeRoleDialog
        candidate={roleChangeCandidate}
        onOpenChange={(isOpen) => !isOpen && setRoleChangeCandidate(null)}
        onConfirm={(reason) => { if(roleChangeCandidate) { handleRoleChangeSubmit(roleChangeCandidate.user.id, roleChangeCandidate.role, reason) }}}
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
       <UserAccessDetailsDialog
         user={viewingUserAccess}
         currentUser={session?.user}
         onOpenChange={(isOpen) => !isOpen && setViewingUserAccess(null)}
         onRoleChange={(user, role) => setRoleChangeCandidate({ user, role })}
         onEditPermissions={handleEditPermissions}
       />
       <BulkActionDialog
            action={bulkAction}
            requestCount={selectedRequestIds.length}
            onOpenChange={(isOpen) => !isOpen && setBulkAction(null)}
            onConfirm={(reason) => {
                if(bulkAction) {
                    handleBulkUpdateRequest(selectedRequestIds, bulkAction, reason);
                }
            }}
        />
      <div className="flex flex-col h-full w-full">
        <Header title="Admin Dashboard" />
          <div className="p-4 md:p-6 flex-1 overflow-y-auto">
              <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="pending">
                <TabsList className="grid w-full grid-cols-4 h-auto sm:inline-flex sm:w-auto sm:h-10">
                    <TabsTrigger value="pending">Pending Requests</TabsTrigger>
                    <TabsTrigger value="active">Active Permissions</TabsTrigger>
                    <TabsTrigger value="logs">Access Logs</TabsTrigger>
                    <TabsTrigger value="users">User Management</TabsTrigger>
                </TabsList>
                  <TabsContent value="pending" className="mt-4">
                       {selectedRequestIds.length > 0 && (
                            <div className="mb-4 p-3 bg-muted rounded-lg flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                    <CheckCircle className="h-5 w-5 text-primary" />
                                    <span>{selectedRequestIds.length} request(s) selected</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="destructive" size="sm" onClick={() => setBulkAction('denied')}>
                                        Deny Selected
                                    </Button>
                                    <Button variant="default" size="sm" onClick={() => setBulkAction('approved')}>
                                        Approve Selected
                                    </Button>
                                </div>
                            </div>
                        )}
                      <RequestsTable 
                        requests={pendingRequests} 
                        handleApprove={setApprovalCandidate} 
                        handleDeny={setDenialCandidate} 
                        isLoading={isLoading}
                        selectedRequestIds={selectedRequestIds}
                        onSelectionChange={setSelectedRequestIds}
                      />
                  </TabsContent>
                  <TabsContent value="active" className="mt-4">
                    <ActivePermissionsTable requests={activeRequests} handleRevoke={setRevocationCandidate} isLoading={isLoading} />
                  </TabsContent>
                  <TabsContent value="users" className="mt-4">
                    <div className="grid gap-4 md:grid-cols-3 mb-6">
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Standard Users</CardTitle>
                          <UserIcon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-1/4" /> : standardUserCount}</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Admins & Owners</CardTitle>
                          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-1/4" /> : adminCount}</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Total Buckets</CardTitle>
                          <HardDrive className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-1/4" /> : buckets.length}</div>
                        </CardContent>
                      </Card>
                    </div>
                    <div className="flex justify-end mb-4">
                      <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search by name or email..." className="pl-9" value={userSearchQuery} onChange={(e) => setUserSearchQuery(e.target.value)} />
                      </div>
                    </div>
                      <UsersTable users={filteredUsers} onUserClick={setViewingUserAccess} isLoading={isLoading} />
                  </TabsContent>
                  <TabsContent value="logs" className="mt-4">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
                         <div className="flex flex-wrap items-center gap-2">
                            <AddFilterMenu onFilterSelect={(filter) => setActiveFilterInputs(f => ({...f, [filter]: true}))} />
                            {activeFilterInputs.eventType && <EventTypeFilter selectedTypes={stagedLogFilters.eventTypes} onTypeChange={(types) => setStagedLogFilters(f => ({...f, eventTypes: types}))} />}
                            {activeFilterInputs.user && <UserFilter users={users} selectedUser={stagedLogFilters.userId} onUserChange={(userId) => setStagedLogFilters(f => ({...f, userId}))} />}
                            {activeFilterInputs.date && <DateRangeFilter dateRange={stagedLogFilters.dateRange} onDateChange={(range) => setStagedLogFilters(f => ({...f, dateRange: range}))} />}
                            {isAnyFilterInputActive && (
                                <Button variant="ghost" onClick={handleClearFilters} className="text-muted-foreground hover:text-foreground">
                                    <FilterX className="mr-2 h-4 w-4" /> Clear All
                                </Button>
                            )}
                          </div>
                           <div className="flex items-center gap-2">
                                <Button onClick={handleApplyFilters} disabled={!areFiltersStaged}>Apply</Button>
                               <div className="relative w-full sm:max-w-xs">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        placeholder="Search logs..." 
                                        className="pl-9" 
                                        value={stagedLogFilters.searchQuery} 
                                        onChange={(e) => setStagedLogFilters(f => ({...f, searchQuery: e.target.value}))} 
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleApplyFilters() }}
                                    />
                                </div>
                            </div>
                      </div>
                      <LogsTable logs={logs} isLoading={isLogsLoading} onViewDetails={handleViewDetails} />
                  </TabsContent>
              </Tabs>
          </div>
      </div>
    </>
  );
}

const RequestsTable = ({ requests, handleApprove, handleDeny, isLoading, selectedRequestIds, onSelectionChange }: { requests: AccessRequest[], handleApprove: (req: AccessRequest) => void, handleDeny: (req: AccessRequest) => void, isLoading: boolean, selectedRequestIds: string[], onSelectionChange: (ids: string[]) => void }) => {
    
    const handleSelectAll = (checked: boolean) => {
        onSelectionChange(checked ? requests.map(req => req.id) : []);
    };
    
    const handleSelectOne = (id: string, checked: boolean) => {
        onSelectionChange(
            checked ? [...selectedRequestIds, id] : selectedRequestIds.filter(reqId => reqId !== id)
        );
    };
    
    const isAllSelected = requests.length > 0 && selectedRequestIds.length === requests.length;
    const isIndeterminate = selectedRequestIds.length > 0 && selectedRequestIds.length < requests.length;
    
    return (
    <div className="border rounded-lg">
        <Table>
            <TableHeader>
            <TableRow>
                <TableHead className="w-[50px]">
                     <Checkbox 
                        checked={isAllSelected}
                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                        aria-label="Select all requests"
                        data-state={isIndeterminate ? 'indeterminate' : isAllSelected ? 'checked' : 'unchecked'}
                    />
                </TableHead>
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
              Array.from({ length: 3 }).map((_, i) => (<TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>))
            ) : requests.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center">No pending requests.</TableCell></TableRow>
            ) : requests.map((req) => (
                <TableRow key={req.id} data-state={selectedRequestIds.includes(req.id) ? 'selected' : undefined}>
                <TableCell>
                    <Checkbox
                        checked={selectedRequestIds.includes(req.id)}
                        onCheckedChange={(checked) => handleSelectOne(req.id, !!checked)}
                        aria-label={`Select request from ${req.userName}`}
                    />
                </TableCell>
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
                        <Button variant="outline" size="sm" className="text-red-600 border-red-600/50 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/50 dark:hover:text-red-400" onClick={() => handleDeny(req)}>Deny</Button>
                        <Button variant="default" size="sm" onClick={() => handleApprove(req)}>Approve</Button>
                    </div>
                </TableCell>
                </TableRow>
            ))}
            </TableBody>
        </Table>
    </div>
    )
};

const ActivePermissionsTable = ({ requests, handleRevoke, isLoading }: { requests: AccessRequest[], handleRevoke: (req: AccessRequest) => void, isLoading: boolean }) => (
    <div className="border rounded-lg">
        <Table>
            <TableHeader>
            <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Bucket</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Approved By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (<TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell></TableRow>))
            ) : requests.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center">No active temporary permissions.</TableCell></TableRow>
            ) : requests.map((req) => (
                <TableRow key={req.id}>
                    <TableCell>
                        <div className="flex items-center gap-3">
                        <Avatar><AvatarImage src={req.userImage || ''} alt={req.userName || ''} /><AvatarFallback>{req.userName?.charAt(0)}</AvatarFallback></Avatar>
                        <div><div className="font-medium">{req.userName}</div><div className="text-sm text-muted-foreground">{req.userEmail}</div></div>
                        </div>
                    </TableCell>
                    <TableCell><div className="font-medium">{req.bucketName}</div><div className="text-sm text-muted-foreground">{req.region}</div></TableCell>
                    <TableCell>
                        <div className="font-medium">{format(parseISO(req.expiresAt!), 'PPp')}</div>
                        <div className="text-sm text-muted-foreground">{formatDistanceToNow(parseISO(req.expiresAt!), { addSuffix: true })}</div>
                    </TableCell>
                    <TableCell>{req.approvedByUserEmail}</TableCell>
                    <TableCell className="text-right">
                        <Button variant="destructive" size="sm" onClick={() => handleRevoke(req)}>
                            <ShieldOff className="mr-2 h-4 w-4" /> Revoke
                        </Button>
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
            case 'ACCESS_REVOKED': return <ShieldOff className="h-5 w-5 text-purple-500" />;
            case 'ROLE_CHANGE': return <UserCog className="h-5 w-5 text-blue-500" />;
            case 'PERMISSIONS_CHANGE': return <KeyRound className="h-5 w-5 text-yellow-500" />;
            case 'FILE_UPLOAD': return <FileUp className="h-5 w-5 text-green-500" />;
            case 'FILE_DOWNLOAD': return <Download className="h-5 w-5 text-blue-500" />;
            case 'FOLDER_CREATE': return <FolderPlus className="h-5 w-5 text-green-500" />;
            case 'OBJECT_DELETE': return <Trash2 className="h-5 w-5 text-red-500" />;
            default: return null;
        }
    };

    const renderDetails = (log: AuditLog) => {
        const reasonHtml = log.details.reason ? <div className="text-xs text-muted-foreground">Reason: {log.details.reason}</div> : null;
        const targetUserHtml = <span className="font-semibold">{log.target.userEmail || log.target.userName}</span>;
        
        switch (log.eventType) {
            case 'ACCESS_REQUEST_DECISION': {
                const targetBucketHtml = <span className="font-semibold">{log.target.bucketName}</span>;
                const isBulk = !!log.details.isBulk;
                const count = log.details.requestCount || 1;
                return (
                    <div>
                        <div>
                            <span className={`font-semibold ${log.details.status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>{log.details.status?.toUpperCase()}</span>
                            <span> access for </span>
                            {targetUserHtml}
                            <span> to bucket </span>
                            {targetBucketHtml}.
                            {isBulk && <span className="text-xs text-muted-foreground"> (part of bulk action for {count} requests)</span>}
                        </div>
                        {reasonHtml}
                    </div>
                );
            }
            case 'ACCESS_REVOKED': {
                const targetBucketHtml = <span className="font-semibold">{log.target.bucketName}</span>;
                 return (
                    <div>
                        <div>
                            <span className="font-semibold text-purple-600">REVOKED</span>
                            <span> temporary access for </span>
                            {targetUserHtml}
                            <span> to bucket </span>
                            {targetBucketHtml}.
                        </div>
                        {reasonHtml}
                    </div>
                );
            }
            case 'ROLE_CHANGE':
                return (
                    <div>
                        <div>
                            <span>Changed role of </span>
                            {targetUserHtml}
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
                        <div>Updated permanent permissions for {targetUserHtml}.</div>
                        {log.details.permissionsChangeSummary && <div className="text-xs text-muted-foreground">{log.details.permissionsChangeSummary}</div>}
                        {reasonHtml}
                    </div>
                );
            case 'FILE_DOWNLOAD':
            case 'FILE_UPLOAD':
            case 'FOLDER_CREATE':
            case 'OBJECT_DELETE':
                let actionText = '';
                switch (log.eventType) {
                    case 'FILE_DOWNLOAD': actionText = 'Downloaded file'; break;
                    case 'FILE_UPLOAD': actionText = 'Uploaded file'; break;
                    case 'FOLDER_CREATE': actionText = 'Created folder'; break;
                    case 'OBJECT_DELETE': actionText = 'Deleted object'; break;
                }
                return (
                    <div>
                        <div>
                            <span>{actionText} </span>
                            <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">{log.target.objectKey}</span>
                            <span> in bucket </span>
                            <span className="font-semibold">{log.target.bucketName}</span>.
                        </div>
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
                    <TableRow><TableCell colSpan={5} className="h-24 text-center">No logs found for the selected filters.</TableCell></TableRow>
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
                        {(log.eventType === 'ACCESS_REQUEST_DECISION' || log.eventType === 'ACCESS_REVOKED') && (
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

const UsersTable = ({ users, onUserClick, isLoading }: { users: AppUser[], onUserClick: (user: AppUser) => void, isLoading: boolean }) => {
    
    return (
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (<TableRow key={i}><TableCell colSpan={2}><Skeleton className="h-8 w-full" /></TableCell></TableRow>))
                    ) : users.length === 0 ? (
                        <TableRow><TableCell colSpan={2} className="h-24 text-center">No users found.</TableCell></TableRow>
                    ) : users.map((user) => (
                        <TableRow key={user.id} className="group hover:bg-muted/50 cursor-pointer" onClick={() => onUserClick(user)}>
                            <TableCell>
                                <div className="flex items-center gap-3 text-left">
                                    <Avatar><AvatarImage src={user.image || ''} alt={user.name || ''} /><AvatarFallback>{user.name?.charAt(0)}</AvatarFallback></Avatar>
                                    <div>
                                        <div className="font-medium group-hover:underline">{user.name}</div>
                                        <div className="text-sm text-muted-foreground">{user.email}</div>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant={user.role === 'USER' ? 'secondary' : 'default'} className="capitalize">
                                    {user.role === 'OWNER' ? <Crown className="h-4 w-4 mr-1 text-yellow-500" /> : user.role === 'ADMIN' ? <ShieldCheck className="h-4 w-4 mr-1" /> : <UserIcon className="h-4 w-4 mr-1" />}
                                    {user.role ? user.role.toLowerCase() : 'N/A'}
                                </Badge>
                            </TableCell>
                        </TableRow>
                ))}
                </TableBody>
            </Table>
        </div>
    )
};


function AddFilterMenu({ onFilterSelect }: { onFilterSelect: (filter: keyof ActiveFilters) => void }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline">
                    <Plus className="mr-2 h-4 w-4" /> Add Filter
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuLabel>Filter By</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onFilterSelect('eventType')}>Event Type</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onFilterSelect('user')}>User</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onFilterSelect('date')}>Date Range</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function EventTypeFilter({ selectedTypes, onTypeChange }: { selectedTypes: string[], onTypeChange: (types: string[]) => void }) {
    const eventTypeLabels: Record<string, string> = {
        'ACCESS_REQUEST_DECISION': 'Access Decisions',
        'ACCESS_REVOKED': 'Access Revocations',
        'ROLE_CHANGE': 'Role Changes',
        'PERMISSIONS_CHANGE': 'Permissions Changes',
        'FILE_UPLOAD': 'File Uploads',
        'FILE_DOWNLOAD': 'File Downloads',
        'FOLDER_CREATE': 'Folder Creations',
        'OBJECT_DELETE': 'Object Deletions'
    };
    
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                    <Filter className="mr-2 h-4 w-4" />
                    Event Type ({selectedTypes.length > 0 ? selectedTypes.length : 'All'})
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64" align="start">
                <DropdownMenuLabel>Filter by Event Type</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ALL_EVENT_TYPES.map(type => (
                    <DropdownMenuCheckboxItem
                        key={type}
                        checked={selectedTypes.includes(type)}
                        onCheckedChange={(checked) => {
                            const newTypes = checked
                                ? [...selectedTypes, type]
                                : selectedTypes.filter(t => t !== type);
                            onTypeChange(newTypes);
                        }}
                        onSelect={(e) => e.preventDefault()} // Prevents menu from closing
                    >
                        {eventTypeLabels[type] || type}
                    </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function UserFilter({ users, selectedUser, onUserChange }: { users: AppUser[], selectedUser: string | null, onUserChange: (userId: string | null) => void }) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');

    const filteredUsers = users.filter(user => user.name?.toLowerCase().includes(search.toLowerCase()) || user.email?.toLowerCase().includes(search.toLowerCase()));
    const selectedUserName = users.find(u => u.id === selectedUser)?.name || 'All Users';

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="w-full sm:w-[200px] justify-between">
                    <span className="truncate">{selectedUserName}</span>
                    <UserIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0" align="start">
                <div className="p-2">
                    <Input placeholder="Search user..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <ScrollArea className="h-[200px]">
                    <div className="p-1">
                        <Button variant="ghost" className="w-full justify-start" onClick={() => { onUserChange(null); setOpen(false); }}>All Users</Button>
                        {filteredUsers.map(user => (
                            <Button key={user.id} variant="ghost" className="w-full justify-start" onClick={() => { onUserChange(user.id); setOpen(false); }}>
                                {user.name}
                            </Button>
                        ))}
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}

function DateRangeFilter({ dateRange, onDateChange }: { dateRange: DateRange | undefined, onDateChange: (range: DateRange | undefined) => void }) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant={"outline"} className={cn("w-full sm:w-auto justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                        dateRange.to ? (
                            <>
                                {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                            </>
                        ) : (
                            format(dateRange.from, "LLL dd, y")
                        )
                    ) : (
                        <span>Pick a date</span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={onDateChange}
                    numberOfMonths={2}
                />
            </PopoverContent>
        </Popover>
    );
}
