
"use client";

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import type { AppUser, Bucket, Region } from '@/lib/types';
import { Loader2, ShieldCheck, Search, HardDrive } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Label } from './ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';

const permissionsSchema = z.object({
  reason: z.string().min(10, 'Please provide a reason of at least 10 characters.'),
  buckets: z.array(z.string()),
});

type PermissionsFormValues = z.infer<typeof permissionsSchema>;

interface AssignBucketsDialogProps {
  user: AppUser | null;
  onOpenChange: (isOpen: boolean) => void;
  onPermissionsChanged: () => void;
}

export function AssignBucketsDialog({ user, onOpenChange, onPermissionsChanged }: AssignBucketsDialogProps) {
  const [allBuckets, setAllBuckets] = useState<Bucket[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const isOpen = !!user;

  const form = useForm<PermissionsFormValues>({
    resolver: zodResolver(permissionsSchema),
    defaultValues: {
      reason: '',
      buckets: [],
    },
  });

  useEffect(() => {
    if (isOpen && user) {
      setIsLoading(true);
      form.reset();
      setSearchQuery('');
      setSelectedRegion('all');
      Promise.all([
        fetch('/api/buckets').then(res => res.json()),
        fetch(`/api/users/${user.id}/permissions`).then(res => res.json()),
        fetch('/api/regions').then(res => res.json())
      ]).then(([bucketsData, permissionsData, regionsData]) => {
        setAllBuckets(Array.isArray(bucketsData) ? bucketsData : []);
        setRegions(Array.isArray(regionsData) ? regionsData : []);
        form.setValue('buckets', permissionsData.buckets || []);
      }).catch(err => {
        console.error("Failed to load data for dialog", err);
        toast({ title: "Error", description: "Could not load bucket and permission data.", variant: "destructive" });
      }).finally(() => {
        setIsLoading(false);
      });
    }
  }, [isOpen, user, form]);

  const onSubmit = async (values: PermissionsFormValues) => {
    if (!user) return;
    
    try {
      const response = await fetch(`/api/users/${user.id}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buckets: values.buckets, reason: values.reason }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update permissions");
      }
      toast({
        title: 'Permissions Updated',
        description: `Bucket permissions for ${user.name} have been updated.`,
      });
      onPermissionsChanged();
      onOpenChange(false);
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Error',
        description: error.message || 'Could not update permissions. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const assignedBuckets = form.watch('buckets');

  const filteredAndSortedBuckets = useMemo(() => {
    return allBuckets
      .filter(bucket => selectedRegion === 'all' || bucket.region === selectedRegion)
      .filter(bucket => bucket.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allBuckets, selectedRegion, searchQuery]);


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck /> Assign Buckets</DialogTitle>
          {user && (
            <DialogDescription>
              Select the buckets that <strong>{user.name}</strong> should have permanent access to. A reason for this change is required for audit purposes.
            </DialogDescription>
          )}
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center items-center h-48">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search buckets..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Filter by region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Regions</SelectItem>
                    {regions.map(region => (
                      <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="relative">
                <div className="text-sm text-muted-foreground mb-2">
                    Selected {assignedBuckets.length} of {filteredAndSortedBuckets.length} buckets shown.
                </div>
                <ScrollArea className="h-64 border rounded-md p-1">
                    <div className="p-2 space-y-1">
                    {filteredAndSortedBuckets.length > 0 ? filteredAndSortedBuckets.map(bucket => (
                        <div key={bucket.name} className="flex items-center rounded-md p-2 hover:bg-accent has-[[data-state=checked]]:bg-accent">
                        <Checkbox
                            id={`bucket-${bucket.name}`}
                            className="mr-3"
                            checked={assignedBuckets.includes(bucket.name)}
                            onCheckedChange={(checked) => {
                            const currentBuckets = form.getValues('buckets');
                            if (checked) {
                                form.setValue('buckets', [...currentBuckets, bucket.name]);
                            } else {
                                form.setValue('buckets', currentBuckets.filter(b => b !== bucket.name));
                            }
                            }}
                        />
                        <Label htmlFor={`bucket-${bucket.name}`} className="text-sm font-medium leading-none flex items-center gap-2 w-full cursor-pointer">
                            <HardDrive className="h-4 w-4 text-muted-foreground" />
                            <div className="flex flex-col">
                               <span>{bucket.name}</span>
                               <span className="text-xs text-muted-foreground">{bucket.region}</span>
                            </div>
                        </Label>
                        </div>
                    )) : (
                        <div className="text-sm text-muted-foreground text-center h-full flex items-center justify-center p-8">No buckets match your filters.</div>
                    )}
                    </div>
                </ScrollArea>
              </div>

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for Change</FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g., Granting access for new project responsibilities." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" disabled={isLoading || form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Permissions
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
