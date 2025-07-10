
"use client";

import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import type { AppUser, Bucket, Region, UserPermissions } from '@/lib/types';
import { Loader2, ShieldCheck, Search, HardDrive, Trash2, Edit } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
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
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Switch } from './ui/switch';
import { cn } from '@/lib/utils';


const permissionsSchema = z.object({
  reason: z.string().min(10, 'Please provide a reason of at least 10 characters.'),
  write: z.object({
      access: z.enum(['none', 'all', 'selective']),
      buckets: z.array(z.string()),
  }),
  canDelete: z.boolean(),
}).refine(data => {
    if (data.write.access === 'selective' && data.write.buckets.length === 0) {
        return false;
    }
    return true;
}, {
    message: 'Please select at least one bucket for selective access.',
    path: ['write.buckets'],
});

type PermissionsFormValues = z.infer<typeof permissionsSchema>;

interface AssignBucketsDialogProps {
  user: AppUser | null;
  onOpenChange: (isOpen: boolean) => void;
  onPermissionsChanged: () => void;
}

const defaultValues: PermissionsFormValues = {
    reason: '',
    write: { access: 'none', buckets: [] },
    canDelete: false
};

export function AssignBucketsDialog({ user, onOpenChange, onPermissionsChanged }: AssignBucketsDialogProps) {
  const [allBuckets, setAllBuckets] = useState<Bucket[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const isOpen = !!user;

  const form = useForm<PermissionsFormValues>({
    resolver: zodResolver(permissionsSchema),
    defaultValues: defaultValues,
  });
  
  const writeAccessType = form.watch('write.access');

  useEffect(() => {
    if (isOpen && user) {
      setIsLoading(true);
      form.reset(defaultValues);
      setSearchQuery('');
      setSelectedRegion('all');
      Promise.all([
        fetch('/api/buckets').then(res => res.json()),
        fetch(`/api/users/${user.id}/permissions`).then(res => res.json()),
        fetch('/api/regions').then(res => res.json())
      ]).then(([bucketsData, permissionsData, regionsData]) => {
        setAllBuckets(Array.isArray(bucketsData) ? bucketsData : []);
        setRegions(Array.isArray(regionsData) ? regionsData : []);
        if (permissionsData) {
            form.reset({
                reason: '',
                write: permissionsData.write || defaultValues.write,
                canDelete: permissionsData.canDelete || defaultValues.canDelete,
            });
        }
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
        body: JSON.stringify({ permissions: values, reason: values.reason }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update permissions");
      }
      toast({
        title: 'Permissions Updated',
        description: `Permissions for ${user.name} have been updated.`,
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

  const filteredAndSortedBuckets = useMemo(() => {
    return allBuckets
      .filter(bucket => selectedRegion === 'all' || bucket.region === selectedRegion)
      .filter(bucket => bucket.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allBuckets, selectedRegion, searchQuery]);


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck /> Assign Permanent Permissions</DialogTitle>
          {user && (
            <DialogDescription>
              Set permanent Write and Delete permissions for <strong>{user.name}</strong>. Read access to all buckets is default.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mr-6 pr-6">
            {isLoading ? (
            <div className="flex justify-center items-center h-full px-6">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            ) : (
            <Form {...form}>
                <form id="assign-permissions-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6">
                    {/* WRITE PERMISSIONS */}
                    <div className="space-y-4 p-4 border rounded-lg">
                        <div className="flex items-center gap-2">
                           <Edit className="h-5 w-5 text-primary" />
                           <h3 className="text-lg font-semibold">Write Access</h3>
                        </div>
                        <FormField
                            control={form.control}
                            name="write.access"
                            render={({ field }) => (
                                <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-3 gap-4">
                                    <Label className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary">
                                        <RadioGroupItem value="none" className="sr-only" />
                                        <p className="font-bold">None</p>
                                        <p className="text-xs text-muted-foreground">No write access.</p>
                                    </Label>
                                    <Label className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary">
                                        <RadioGroupItem value="all" className="sr-only" />
                                        <p className="font-bold">All Buckets</p>
                                        <p className="text-xs text-muted-foreground">Access to all.</p>
                                    </Label>
                                    <Label className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary">
                                        <RadioGroupItem value="selective" className="sr-only" />
                                        <p className="font-bold">Selective</p>
                                        <p className="text-xs text-muted-foreground">Choose specific.</p>
                                    </Label>
                                </RadioGroup>
                            )}
                        />

                        <div className={cn("space-y-4 transition-opacity duration-300", writeAccessType === 'selective' ? 'opacity-100' : 'opacity-50 pointer-events-none')}>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder="Search buckets..." className="pl-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} disabled={writeAccessType !== 'selective'} />
                                </div>
                                <Select value={selectedRegion} onValueChange={setSelectedRegion} disabled={writeAccessType !== 'selective'}>
                                    <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Filter by region" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Regions</SelectItem>
                                        {regions.map(region => (<SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <Controller
                                control={form.control}
                                name="write.buckets"
                                render={({ field }) => (
                                    <>
                                        <ScrollArea className="h-48 border rounded-md">
                                            <div className="p-2">
                                                {filteredAndSortedBuckets.length > 0 ? (
                                                    <div className="space-y-1">
                                                        {filteredAndSortedBuckets.map(bucket => (
                                                            <Label key={bucket.name} className="flex cursor-pointer items-center space-x-3 rounded-md p-2 font-normal hover:bg-accent has-[input:checked]:bg-accent">
                                                                <Checkbox
                                                                    checked={field.value?.includes(bucket.name)}
                                                                    onCheckedChange={(checked) => {
                                                                        const newValue = checked
                                                                            ? [...field.value, bucket.name]
                                                                            : field.value?.filter((value) => value !== bucket.name);
                                                                        field.onChange(newValue);
                                                                    }}
                                                                    disabled={writeAccessType !== 'selective'}
                                                                />
                                                                <HardDrive className="h-4 w-4 text-muted-foreground" />
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium leading-none">{bucket.name}</span>
                                                                    <span className="text-xs text-muted-foreground">{bucket.region}</span>
                                                                </div>
                                                            </Label>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">No buckets match your filters.</div>
                                                )}
                                            </div>
                                        </ScrollArea>
                                         <FormMessage>{form.formState.errors.write?.buckets?.message}</FormMessage>
                                    </>
                                )}
                            />
                        </div>
                    </div>

                    {/* DELETE PERMISSIONS */}
                    <div className="space-y-4 p-4 border rounded-lg">
                        <div className="flex items-center gap-2">
                           <Trash2 className="h-5 w-5 text-destructive" />
                           <h3 className="text-lg font-semibold">Delete Permission</h3>
                        </div>
                        <FormField
                            control={form.control}
                            name="canDelete"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Enable Delete</FormLabel>
                                        <FormDescription>Allow this user to delete objects and folders in buckets where they have write access.</FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>

                    {/* REASON FOR CHANGE */}
                    <FormField
                        control={form.control}
                        name="reason"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Reason for Change (Required)</FormLabel>
                            <FormControl>
                                <Textarea placeholder="e.g., Granting access for new project responsibilities." {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </form>
            </Form>
            )}
        </div>

        {!isLoading && (
            <DialogFooter className="pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" form="assign-permissions-form" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Permissions
                </Button>
            </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
