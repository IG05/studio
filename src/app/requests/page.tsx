
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
import type { AccessRequest } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
  } from "@/components/ui/tabs";
import { Skeleton } from '@/components/ui/skeleton';
import { Info, MoreVertical, Eye } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { RequestDetailsDialog } from '@/components/request-details-dialog';

export default function MyRequestsPage() {
  const [requests, setRequests] = React.useState<AccessRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('pending');
  const [viewingRequest, setViewingRequest] = React.useState<AccessRequest | null>(null);

  React.useEffect(() => {
    const fetchRequests = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/access-requests');
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to fetch access requests.');
            }
            
            setRequests(Array.isArray(data) ? data : []);
        } catch (err: any) {
            console.error("Failed to fetch access requests", err);
            setRequests([]);
            toast({ title: 'Error', description: err.message || 'Could not fetch your access requests.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    fetchRequests();
  }, []);

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
      <Header title="My Access Requests" />
        <div className="p-4 md:p-6 flex-1 overflow-y-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                    <TabsTrigger value="pending">Pending</TabsTrigger>
                    <TabsTrigger value="historical">Historical</TabsTrigger>
                </TabsList>
                <TabsContent value="pending">
                    <RequestsTable requests={filteredRequests} getBadgeVariant={getBadgeVariant} isLoading={isLoading} onViewDetails={setViewingRequest} />
                </TabsContent>
                <TabsContent value="historical">
                    <RequestsTable requests={filteredRequests} getBadgeVariant={getBadgeVariant} isLoading={isLoading} onViewDetails={setViewingRequest} />
                </TabsContent>
            </Tabs>
        </div>
    </div>
    </>
  );
}

const RequestsTable = ({ requests, getBadgeVariant, isLoading, onViewDetails }: { requests: AccessRequest[], getBadgeVariant: (status: AccessRequest['status']) => string, isLoading: boolean, onViewDetails: (req: AccessRequest) => void }) => (
    <div className="border rounded-lg">
        <Table>
            <TableHeader>
            <TableRow>
                <TableHead>Bucket</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell>
                </TableRow>
              ))
            ) : requests.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">You have not made any requests in this category.</TableCell>
                </TableRow>
            ) : requests.map((req) => (
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
            ))}
            </TableBody>
        </Table>
    </div>
);
