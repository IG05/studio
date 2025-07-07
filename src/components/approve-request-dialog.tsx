
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
import { Loader2 } from 'lucide-react';

const approveRequestSchema = z.object({
  reason: z.string().min(10, 'Please provide a reason of at least 10 characters.'),
});

type ApproveRequestFormValues = z.infer<typeof approveRequestSchema>;

interface ApproveRequestDialogProps {
  request: AccessRequest | null;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (reason: string) => void;
}

export function ApproveRequestDialog({ request, onOpenChange, onConfirm }: ApproveRequestDialogProps) {
  const isOpen = !!request;

  const form = useForm<ApproveRequestFormValues>({
    resolver: zodResolver(approveRequestSchema),
    defaultValues: {
      reason: '',
    },
  });

  useEffect(() => {
    if (!isOpen) {
      form.reset();
    }
  }, [isOpen, form]);

  const onSubmit = async (values: ApproveRequestFormValues) => {
    onConfirm(values.reason);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Approve Access Request</DialogTitle>
          {request && (
            <DialogDescription>
              Provide a reason for approving access to <strong>{request.bucketName}</strong> for user <strong>{request.userName}</strong>. This is required for auditing.
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
                  <FormLabel>Reason for Approval</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., Access granted for specific issue debugging..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" variant="default" disabled={!form.formState.isValid || form.formState.isSubmitting}>
                    {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm Approval
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
