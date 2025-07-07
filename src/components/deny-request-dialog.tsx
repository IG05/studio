
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
import { toast } from '@/hooks/use-toast';
import type { AccessRequest } from '@/lib/types';
import { Loader2 } from 'lucide-react';

const denyRequestSchema = z.object({
  reason: z.string().min(10, 'Please provide a denial reason of at least 10 characters.'),
});

type DenyRequestFormValues = z.infer<typeof denyRequestSchema>;

interface DenyRequestDialogProps {
  request: AccessRequest | null;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (reason: string) => void;
}

export function DenyRequestDialog({ request, onOpenChange, onConfirm }: DenyRequestDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isOpen = !!request;

  const form = useForm<DenyRequestFormValues>({
    resolver: zodResolver(denyRequestSchema),
    defaultValues: {
      reason: '',
    },
  });

  useEffect(() => {
    if (!isOpen) {
      form.reset();
    }
  }, [isOpen, form]);

  const onSubmit = async (values: DenyRequestFormValues) => {
    setIsSubmitting(true);
    try {
      onConfirm(values.reason);
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'Could not deny the request. Please try again.',
        variant: 'destructive',
      });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Deny Access Request</DialogTitle>
          {request && (
            <DialogDescription>
              Provide a reason for denying access to <strong>{request.bucketName}</strong> for user <strong>{request.userName}</strong>.
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
                  <FormLabel>Reason for Denial</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., This bucket contains sensitive PII..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" variant="destructive" disabled={!form.formState.isValid || isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm Denial
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
