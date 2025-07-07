
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
import type { AccessRequest } from '@/lib/types';
import type { AppUser } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, MoreVertical, ShieldCheck, User as UserIcon, Check, KeyRound, Crown, Search } from 'lucide-react';
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
import { useSession } from 'next-auth/react';
import { AssignBucketsDialog } from '@/components/assign-buckets-dialog';
import { Input } from '@/components/ui/input';

const formatExpiresAt = (expiresAt: string | null | undefined) => {
    if (!expiresAt) return 'Permanent';
    try {
        const date = parseISO(expiresAt);
        return format(date, 'PPp');
    } catch (error) {
        console.error("Invalid date for expiresAt:", expiresAt);
        return 'Invalid Date';
    }
};


export default function AdminPage() {
  const [requests, setRequests] = React.useState<AccessRequest[]>([]);
  const [users, setUsers] = React.useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('pending');
  const [denialCandidate, setDenialCandidate] = React.useState<AccessRequest | null>(null);
  const [permissionUser, setPermissionUser] = React.useState<AppUser | null>(null);
  const [userSearchQuery, setUserSearchQuery] = React.useState('');

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [requestsRes, usersRes] = await Promise.all([
          fetch('/api/access-requests'),
          fetch('/api/users'),
        ]);

        if (!requestsRes.ok) {
          const errorData = await requestsRes.json().catch(() => ({ error: 'Failed to parse error response' }));
          throw new Error(errorData.error || 'Failed to fetch access requests.');
        }
        const requestsData = await requestsRes.json();
        
        if (!usersRes.ok) {
          const errorData = await usersRes.json().catch(() => ({ error: 'Failed to parse error response' }));
          throw new Error(errorData.error || 'Failed to fetch users.');
        }
        const usersData = await usersRes.json();

        setRequests(Array.isArray(requestsData) ? requestsData : []);
        setUsers(Array.isArray(usersData) ? usersData : []);

      } catch (err: any) {
        console.error("Failed to fetch admin data", err);
        setRequests([]);
        setUsers([]);
        toast({
          title: 'Error',
          description: err.message || 'Could not fetch admin data.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleRequest = (requestId: string, status: 'approved' | 'denied', reason?: string) => {
    const originalRequests = [...requests];
    
    // Optimistic update
    setRequests((prev) =>
      prev.map((req) => (req.id === requestId ? { ...req, status, denialReason: reason } : req))
    );

    fetch(`/api/access-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, denialReason: reason }),
    })
    .then(res => {
        if (!res.ok) throw new Error("Failed to update");
        return res.json();
    })
    .then(updatedRequest => {
        setRequests(prev => prev.map(r => r.id === updatedRequest.id ? updatedRequest : r));
        toast({
            title: `Request ${status}`,
            description: `The access request has been successfully ${status}.`,
        });
    })
    .catch(() => {
        // Rollback on error
        setRequests(originalRequests);
        toast({
            title: 'Error',
            description: 'Failed to update access request.',
            variant: 'destructive',
        });
    });
  };
  
  const handleRoleChange = (userId: string, role: string) => {
    const originalUsers = [...users];

    setUsers((prev) => prev.map(u => u.id === userId ? { ...u, role: role as AppUser['role'] } : u));

    fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
    })
    .then(res => {
        if (!res.ok) throw res.json();
        return res.json();
    })
    .then(updatedUser => {
        setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
        toast({
            title: 'User Updated',
            description: `User role has been successfully changed to ${role}.`,
        });
    })
    .catch(async (err) => {
        const error = await err;
        setUsers(originalUsers);
        toast({
            title: 'Error',
            description: error.error || 'Failed to update user role.',
            variant: 'destructive',
        });
    });
  }

  const getBadgeVariant = (status: AccessRequest['status']) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
      case 'denied':
        return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
      case 'pending':
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
    }
  };

  const filteredRequests = requests.filter(req => {
    if (activeTab === 'pending') return req.status === 'pending';
    if (activeTab === 'historical') return req.status === 'approved' || req.status === 'denied';
    return true;
  });

  const filteredUsers = React.useMemo(() => {
    if (!userSearchQuery) {
      return users;
    }
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
        onConfirm={(reason) => {
            if(denialCandidate) {
                handleRequest(denialCandidate.id, 'denied', reason)
            }
        }}
       />
       <AssignBucketsDialog
        user={permissionUser}
        onOpenChange={(isOpen) => !isOpen && setPermissionUser(null)}
       />
      <div className="flex flex-col h-full w-full">
        <Header title="Admin Dashboard" />
          <div className="p-4 md:p-6 flex-1 overflow-y-auto">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="mb-4">
                      <TabsTrigger value="pending">Pending Requests</TabsTrigger>
                      <TabsTrigger value="historical">Request History</TabsTrigger>
                      <TabsTrigger value="users">User Management</TabsTrigger>
                  </TabsList>
                  <TabsContent value="pending">
                      <RequestsTable requests={filteredRequests} handleApprove={id => handleRequest(id, 'approved')} handleDeny={setDenialCandidate} getBadgeVariant={getBadgeVariant} isLoading={isLoading} />
                  </TabsContent>
                  <TabsContent value="historical">
                      <RequestsTable requests={filteredRequests} handleApprove={id => handleRequest(id, 'approved')} handleDeny={setDenialCandidate} getBadgeVariant={getBadgeVariant} isLoading={isLoading} />
                  </TabsContent>
                  <TabsContent value="users">
                    <div className="flex justify-end mb-4">
                      <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by name or email..."
                          className="pl-9"
                          value={userSearchQuery}
                          onChange={(e) => setUserSearchQuery(e.target.value)}
                        />
                      </div>
                    </div>
                      <UsersTable users={filteredUsers} onRoleChange={handleRoleChange} onAssignBuckets={setPermissionUser} isLoading={isLoading} />
                  </TabsContent>
              </Tabs>
          </div>
      </div>
    </>
  );
}

const RequestsTable = ({ requests, handleApprove, handleDeny, getBadgeVariant, isLoading }: { requests: AccessRequest[], handleApprove: (id: string) => void, handleDeny: (req: AccessRequest) => void, getBadgeVariant: (status: AccessRequest['status']) => string, isLoading: boolean }) => (
    <div className="border rounded-lg">
        <Table>
            <TableHeader>
            <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Bucket</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Expires At</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell>
                </TableRow>
              ))
            ) : requests.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">No requests found.</TableCell>
                </TableRow>
            ) : requests.map((req) => {
                let requestedAtDate = "Invalid Date";
                let requestedAtTime = "Invalid Date";
                try {
                    if(req.requestedAt) {
                        const parsedDate = parseISO(req.requestedAt);
                        requestedAtDate = format(parsedDate, 'PP');
                        requestedAtTime = format(parsedDate, 'p');
                    }
                } catch(e) {
                    // Keep invalid date strings
                }

                return (
                <TableRow key={req.id}>
                <TableCell>
                    <div className="flex items-center gap-3">
                    <Avatar>
                        <AvatarImage src={req.userImage || ''} alt={req.userName || ''} />
                        <AvatarFallback>{req.userName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <div className="font-medium">{req.userName}</div>
                        <div className="text-sm text-muted-foreground">{req.userEmail}</div>
                    </div>
                    </div>
                </TableCell>
                <TableCell>
                    <div className="font-medium">{req.bucketName}</div>
                    <div className="text-sm text-muted-foreground">{req.region}</div>
                </TableCell>
                <TableCell className="max-w-xs truncate">{req.reason}</TableCell>
                <TableCell>
                    <div className="font-medium">{formatExpiresAt(req.expiresAt)}</div>
                </TableCell>
                <TableCell>
                    <div className="font-medium">{requestedAtDate}</div>
                    <div className="text-sm text-muted-foreground">{requestedAtTime}</div>
                </TableCell>
                <TableCell>
                    <Badge className={getBadgeVariant(req.status)}>{req.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                    {req.status === 'pending' ? (
                    <div className="flex gap-2 justify-end">
                        <Button
                        variant="ghost"
                        size="icon"
                        className="text-green-600 hover:text-green-600 hover:bg-green-100 dark:hover:bg-green-900/50"
                        onClick={() => handleApprove(req.id)}
                        >
                        <CheckCircle className="h-5 w-5" />
                        </Button>
                        <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50"
                        onClick={() => handleDeny(req)}
                        >
                        <XCircle className="h-5 w-5" />
                        </Button>
                    </div>
                    ) : (
                    <div className='flex justify-end'>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <MoreVertical className="h-5 w-5" />
                            </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    )}
                </TableCell>
                </TableRow>
            )})}
            </TableBody>
        </Table>
    </div>
);


const UsersTable = ({ users, onRoleChange, onAssignBuckets, isLoading }: { users: AppUser[], onRoleChange: (userId: string, role: string) => void, onAssignBuckets: (user: AppUser) => void, isLoading: boolean }) => {
    const { data: session } = useSession();
    const isOwner = session?.user?.role === 'owner';
    
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
                    Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                        <TableCell colSpan={3}><Skeleton className="h-8 w-full" /></TableCell>
                        </TableRow>
                    ))
                    ) : users.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={3} className="h-24 text-center">No users found.</TableCell>
                        </TableRow>
                    ) : users.map((user) => (
                        <TableRow key={user.id}>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                <Avatar>
                                    <AvatarImage src={user.image || ''} alt={user.name || ''} />
                                    <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <div className="font-medium">{user.name}</div>
                                    <div className="text-sm text-muted-foreground">{user.email}</div>
                                </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant={user.role === 'USER' ? 'secondary' : 'default'} className="capitalize">
                                    {user.role === 'OWNER' ? (
                                        <Crown className="h-4 w-4 mr-1 text-yellow-500" />
                                    ) : user.role === 'ADMIN' ? (
                                        <ShieldCheck className="h-4 w-4 mr-1" />
                                    ) : (
                                        <UserIcon className="h-4 w-4 mr-1" />
                                    )}
                                    {user.role ? user.role.toLowerCase() : 'N/A'}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" disabled={user.role === 'OWNER'}>
                                            <MoreVertical className="h-5 w-5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onClick={() => onRoleChange(user.id, 'ADMIN')} disabled={!isOwner || user.id === session?.user?.id || user.role === 'ADMIN'}>
                                            <ShieldCheck className="mr-2 h-4 w-4" />
                                            Make Admin
                                            {user.role === 'ADMIN' && <Check className="ml-auto h-4 w-4" />}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onRoleChange(user.id, 'USER')} disabled={!isOwner || user.id === session?.user?.id || user.role === 'USER'}>
                                            <UserIcon className="mr-2 h-4 w-4" />
                                            Make User
                                            {user.role === 'USER' && <Check className="ml-auto h-4 w-4" />}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => onAssignBuckets(user)}
                                            disabled={user.role === 'ADMIN' || user.role === 'OWNER'}
                                        >
                                            <KeyRound className="mr-2 h-4 w-4" />
                                            Assign Buckets
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
