
"use client";

import { useEffect, useState } from 'react';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import type { AccessRequest } from '@/lib/types';
import { Loader2, ShieldOff } from 'lucide-react';

const revokeAccessSchema = z.object({
  reason: z.string().min(10, 'Please provide a revocation reason of at least 10 characters.'),
});

type RevokeAccessFormValues = z.infer<typeof revokeAccessSchema>;

interface RevokeAccessDialogProps {
  request: AccessRequest | null;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (reason: string) => void;
}

export function RevokeAccessDialog({ request, onOpenChange, onConfirm }: RevokeAccessDialogProps) {
  const isOpen = !!request;

  const form = useForm<RevokeAccessFormValues>({
    resolver: zodResolver(revokeAccessSchema),
    defaultValues: {
      reason: '',
    },
  });

  useEffect(() => {
    if (!isOpen) {
      form.reset();
    }
  }, [isOpen, form]);

  const onSubmit = async (values: RevokeAccessFormValues) => {
    onConfirm(values.reason);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldOff className="h-5 w-5" />
            Revoke Temporary Access
          </DialogTitle>
          {request && (
            <DialogDescription>
              You are revoking temporary access to <strong>{request.bucketName}</strong> for user <strong>{request.userName}</strong>. This action is irreversible and will be logged.
            </DialogDescription>
          )}
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Revocation</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., User's task is complete, revoking access as per security policy." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" variant="destructive" disabled={!form.formState.isValid || form.formState.isSubmitting}>
                    {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm Revocation
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
