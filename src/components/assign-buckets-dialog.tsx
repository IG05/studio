
"use client";

import { useEffect, useState } from 'react';
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
import type { AppUser, Bucket } from '@/lib/types';
import { Loader2, ShieldCheck } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Label } from './ui/label';

interface AssignBucketsDialogProps {
  user: AppUser | null;
  onOpenChange: (isOpen: boolean) => void;
}

export function AssignBucketsDialog({ user, onOpenChange }: AssignBucketsDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allBuckets, setAllBuckets] = useState<Bucket[]>([]);
  const [assignedBuckets, setAssignedBuckets] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const isOpen = !!user;

  useEffect(() => {
    if (isOpen && user) {
      setIsLoading(true);
      Promise.all([
        fetch('/api/buckets').then(res => res.json()),
        fetch(`/api/users/${user.id}/permissions`).then(res => res.json())
      ]).then(([bucketsData, permissionsData]) => {
        setAllBuckets(bucketsData);
        setAssignedBuckets(new Set(permissionsData.buckets || []));
      }).catch(err => {
        console.error("Failed to load data for dialog", err);
        toast({ title: "Error", description: "Could not load bucket and permission data.", variant: "destructive" });
      }).finally(() => {
        setIsLoading(false);
      });
    }
  }, [isOpen, user]);

  const handleCheckboxChange = (bucketName: string, checked: boolean) => {
    setAssignedBuckets(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(bucketName);
      } else {
        newSet.delete(bucketName);
      }
      return newSet;
    });
  };

  const onSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/users/${user.id}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buckets: Array.from(assignedBuckets) }),
      });
      if (!response.ok) {
        throw new Error("Failed to update permissions");
      }
      toast({
        title: 'Permissions Updated',
        description: `Bucket permissions for ${user.name} have been updated.`,
      });
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'Could not update permissions. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck /> Assign Buckets</DialogTitle>
          {user && (
            <DialogDescription>
              Select the buckets that <strong>{user.name}</strong> should have permanent access to.
            </DialogDescription>
          )}
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center items-center h-48">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <ScrollArea className="h-64 border rounded-md p-4">
            <div className="space-y-4">
              {allBuckets.length > 0 ? allBuckets.map(bucket => (
                <div key={bucket.name} className="flex items-center space-x-2">
                  <Checkbox
                    id={`bucket-${bucket.name}`}
                    checked={assignedBuckets.has(bucket.name)}
                    onCheckedChange={(checked) => handleCheckboxChange(bucket.name, !!checked)}
                  />
                  <Label htmlFor={`bucket-${bucket.name}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {bucket.name}
                  </Label>
                </div>
              )) : (
                <div className="text-sm text-muted-foreground text-center h-full flex items-center justify-center">No buckets found.</div>
              )}
            </div>
          </ScrollArea>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={onSubmit} disabled={isLoading || isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Permissions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
