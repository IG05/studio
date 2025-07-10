
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
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

const bulkActionSchema = z.object({
  reason: z.string().min(10, 'Please provide a reason of at least 10 characters.'),
});

type BulkActionFormValues = z.infer<typeof bulkActionSchema>;

interface BulkActionDialogProps {
  action: 'approve' | 'deny' | null;
  requestCount: number;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (reason: string) => void;
}

export function BulkActionDialog({ action, requestCount, onOpenChange, onConfirm }: BulkActionDialogProps) {
  const isOpen = !!action;
  const isApproving = action === 'approve';

  const form = useForm<BulkActionFormValues>({
    resolver: zodResolver(bulkActionSchema),
    defaultValues: {
      reason: '',
    },
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      form.reset();
      setIsSubmitting(false);
    }
  }, [isOpen, form]);

  const onSubmit = async (values: BulkActionFormValues) => {
    setIsSubmitting(true);
    onConfirm(values.reason);
    // The parent component will handle closing the dialog
  };

  if (!action) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isApproving ? <CheckCircle className="text-green-500" /> : <XCircle className="text-red-500" />}
            Bulk {isApproving ? 'Approve' : 'Deny'} Requests
          </DialogTitle>
            <DialogDescription>
              You are about to {action} <strong>{requestCount}</strong> access request(s). Provide a single reason that will be applied to all of them. This action is irreversible.
            </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for {isApproving ? 'Approval' : 'Denial'}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={`e.g., Bulk ${action} for end-of-day cleanup...`} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" variant={isApproving ? 'default' : 'destructive'} disabled={!form.formState.isValid || isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm {action}
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
