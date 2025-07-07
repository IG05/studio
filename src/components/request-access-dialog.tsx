
"use client";

import { ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import type { Bucket } from '@/lib/types';
import { S3BucketIcon } from './icons';
import { Loader2 } from 'lucide-react';

const requestAccessSchema = z.object({
  reason: z.string().min(10, 'Please provide a reason of at least 10 characters.'),
  durationHours: z.coerce.number().int().min(0).max(12),
  durationMinutes: z.coerce.number().int().min(0).max(59),
}).refine(
  (data) => (data.durationHours * 60) + data.durationMinutes >= 15, {
    message: "Total duration must be at least 15 minutes.",
    path: ["durationMinutes"],
  }
).refine(
  (data) => (data.durationHours * 60) + data.durationMinutes <= 720, {
    message: "Total duration cannot exceed 12 hours.",
    path: ["durationHours"],
  }
).refine(
    (data) => data.durationHours !== 12 || data.durationMinutes === 0, {
    message: "If hours is 12, minutes must be 0.",
    path: ["durationMinutes"],
});

type RequestAccessFormValues = z.infer<typeof requestAccessSchema>;

interface RequestAccessDialogProps {
  children: ReactNode;
  bucket: Bucket;
}

export function RequestAccessDialog({ children, bucket }: RequestAccessDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RequestAccessFormValues>({
    resolver: zodResolver(requestAccessSchema),
    defaultValues: {
      reason: '',
      durationHours: 0,
      durationMinutes: 15,
    },
  });

  const onSubmit = async (values: RequestAccessFormValues) => {
    setIsSubmitting(true);
    const durationInMinutes = (values.durationHours * 60) + values.durationMinutes;

    try {
      const response = await fetch('/api/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: values.reason,
          durationInMinutes: durationInMinutes,
          bucketName: bucket.name,
          region: bucket.region,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit request');
      }

      toast({
        title: 'Access Request Submitted',
        description: `Your request for access to "${bucket.name}" has been sent for approval.`,
      });
      setOpen(false); // Close dialog on success
      form.reset();

    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'Could not submit your access request. Please try again.',
        variant: 'destructive',
      });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <S3BucketIcon className="w-5 h-5" /> Request Access
          </DialogTitle>
          <DialogDescription>
            Request temporary access to the bucket: <strong>{bucket.name}</strong>.
            Please provide a reason and select the desired duration.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div className="space-y-2">
                <FormLabel>Duration</FormLabel>
                <div className="flex items-start gap-4">
                    <FormField
                    control={form.control}
                    name="durationHours"
                    render={({ field }) => (
                        <FormItem className="flex-1">
                        <FormLabel>Hours</FormLabel>
                        <FormControl>
                            <Input type="number" min="0" max="12" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="durationMinutes"
                    render={({ field }) => (
                        <FormItem className="flex-1">
                        <FormLabel>Minutes</FormLabel>
                        <FormControl>
                            <Input type="number" min="0" max="59" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
            </div>
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Access</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., Need to debug a production issue..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
                <Button type="submit" disabled={!form.formState.isValid || isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submit Request
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
