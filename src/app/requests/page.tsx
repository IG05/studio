
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

export default function MyRequestsPage() {
  const [requests, setRequests] = React.useState<AccessRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('pending');

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

  return (
    <div className="flex flex-col h-full w-full">
      <Header title="My Access Requests" />
        <div className="p-4 md:p-6 flex-1 overflow-y-auto">
            <TooltipProvider>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="mb-4">
                        <TabsTrigger value="pending">Pending</TabsTrigger>
                        <TabsTrigger value="historical">Historical</TabsTrigger>
                    </TabsList>
                    <TabsContent value="pending">
                        <RequestsTable requests={filteredRequests} getBadgeVariant={getBadgeVariant} isLoading={isLoading} />
                    </TabsContent>
                    <TabsContent value="historical">
                        <RequestsTable requests={filteredRequests} getBadgeVariant={getBadgeVariant} isLoading={isLoading} />
                    </TabsContent>
                </Tabs>
            </TooltipProvider>
        </div>
    </div>
  );
}

const RequestsTable = ({ requests, getBadgeVariant, isLoading }: { requests: AccessRequest[], getBadgeVariant: (status: AccessRequest['status']) => string, isLoading: boolean }) => (
    <div className="border rounded-lg">
        <Table>
            <TableHeader>
            <TableRow>
                <TableHead>Bucket</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead className="text-right">Status</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell>
                </TableRow>
              ))
            ) : requests.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">You have not made any requests.</TableCell>
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
                <TableCell className="text-right">
                    {req.status === 'denied' && req.denialReason ? (
                        <Tooltip>
                            <TooltipTrigger>
                                <div className='flex items-center justify-end gap-2'>
                                    <Badge className={getBadgeVariant(req.status)}>{req.status}</Badge>
                                    <Info className="h-4 w-4 text-muted-foreground" />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className='max-w-xs text-sm'>{req.denialReason}</p>
                            </TooltipContent>
                        </Tooltip>
                    ) : (
                        <Badge className={getBadgeVariant(req.status)}>{req.status}</Badge>
                    )}
                </TableCell>
                </TableRow>
            ))}
            </TableBody>
        </Table>
    </div>
);
