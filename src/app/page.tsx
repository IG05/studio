
"use client";

import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Header } from '@/components/header';
import type { Bucket, Region } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RequestAccessDialog } from '@/components/request-access-dialog';
import { Lock, Unlock, Timer, ChevronRight, Search } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { formatBytes } from '@/lib/utils';

export default function DashboardPage() {
  const [selectedRegion, setSelectedRegion] = React.useState('all');
  const [regions, setRegions] = React.useState<Region[]>([]);
  const [buckets, setBuckets] = React.useState<Bucket[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');

  React.useEffect(() => {
    // Fetch regions
    fetch('/api/regions')
      .then(res => res.json())
      .then(setRegions)
      .catch(err => console.error("Failed to fetch regions", err));
  }, []);

  React.useEffect(() => {
    setIsLoading(true);
    const regionQuery = selectedRegion === 'all' ? '' : `?region=${selectedRegion}`;
    fetch(`/api/buckets${regionQuery}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: 'Failed to parse error response' }));
          throw new Error(errorData.error || 'Failed to fetch buckets');
        }
        return res.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) {
            console.error("API response for buckets is not an array:", data);
            throw new Error('Invalid data format for buckets.');
        }
        setBuckets(data);
      })
      .catch((err) => {
        console.error("Failed to fetch buckets", err);
        setBuckets([]); // Ensure buckets is an array to prevent render errors
        toast({
          title: 'Error Fetching Buckets',
          description: err instanceof Error ? err.message : 'An unknown error occurred.',
          variant: 'destructive',
        });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [selectedRegion]);

  const filteredBuckets = React.useMemo(() => {
    if (!searchQuery) return buckets;
    return buckets.filter(bucket =>
      bucket.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [buckets, searchQuery]);


  const getAccessInfo = (bucket: Bucket) => {
    switch (bucket.access) {
      case 'full':
        return {
          icon: <Unlock className="w-4 h-4 text-green-500" />,
          label: 'Full Access',
          badgeClass: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
        };
      case 'limited':
        return {
          icon: <Timer className="w-4 h-4 text-orange-500" />,
          label: 'Temporary Access',
          badgeClass: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
        };
      case 'none':
      default:
        return {
          icon: <Lock className="w-4 h-4 text-red-500" />,
          label: 'No Access',
          badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
        };
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      <Header title="S3 Buckets Dashboard" />
      <div className="p-4 md:p-6 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-6 gap-4">
          <h2 className="text-2xl font-bold tracking-tight">
            Available Buckets {!isLoading && `(${filteredBuckets.length})`}
          </h2>
          <div className="flex items-center gap-4">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search buckets..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="w-48">
              <Select onValueChange={setSelectedRegion} defaultValue="all">
                <SelectTrigger>
                  <SelectValue placeholder="Filter by region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {regions.map((region) => (
                    <SelectItem key={region.id} value={region.id}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Bucket Name</TableHead>
                        <TableHead>Region</TableHead>
                        <TableHead>Bucket Size</TableHead>
                        <TableHead>Access Status</TableHead>
                        <TableHead>Expires In</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
                            </TableRow>
                        ))
                    ) : filteredBuckets.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">No buckets found.</TableCell>
                        </TableRow>
                    ) : (
                        filteredBuckets.map((bucket) => {
                            const accessInfo = getAccessInfo(bucket);
                            const isAccessible = bucket.access === 'full' || bucket.access === 'limited';
                            return (
                                <TableRow key={bucket.name}>
                                    <TableCell className="font-medium">{bucket.name}</TableCell>
                                    <TableCell>{bucket.region}</TableCell>
                                    <TableCell>{formatBytes(bucket.size)}</TableCell>
                                    <TableCell>
                                        <Badge className={accessInfo.badgeClass}>
                                            <div className="flex items-center gap-2">
                                                {accessInfo.icon}
                                                <span>{accessInfo.label}</span>
                                            </div>
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {bucket.access === 'limited' && bucket.tempAccessExpiresAt ? (
                                            formatDistanceToNow(parseISO(bucket.tempAccessExpiresAt), { addSuffix: true })
                                        ) : (
                                            '--'
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {isAccessible ? (
                                            <Button asChild variant="outline" size="sm">
                                                <Link href={`/buckets/${bucket.name}`}>
                                                    View
                                                    <ChevronRight className="w-4 h-4 ml-2" />
                                                </Link>
                                            </Button>
                                        ) : (
                                            <RequestAccessDialog bucket={bucket}>
                                                <Button variant="default" size="sm">
                                                    Request Access
                                                </Button>
                                            </RequestAccessDialog>
                                        )}
                                    </TableCell>
                                </TableRow>
                            )
                        })
                    )}
                </TableBody>
            </Table>
        </div>
      </div>
    </div>
  );
}

    