
"use client";

import { useEffect } from 'react';
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
import type { AppUser } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Badge } from './ui/badge';

const changeRoleSchema = z.object({
  reason: z.string().min(10, 'Please provide a reason of at least 10 characters.'),
});

type ChangeRoleFormValues = z.infer<typeof changeRoleSchema>;

interface ChangeRoleDialogProps {
  candidate: { user: AppUser; role: 'ADMIN' | 'USER' } | null;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (reason: string) => void;
}

export function ChangeRoleDialog({ candidate, onOpenChange, onConfirm }: ChangeRoleDialogProps) {
  const isOpen = !!candidate;

  const form = useForm<ChangeRoleFormValues>({
    resolver: zodResolver(changeRoleSchema),
    defaultValues: {
      reason: '',
    },
  });

  useEffect(() => {
    if (!isOpen) {
      form.reset();
    }
  }, [isOpen, form]);

  const onSubmit = async (values: ChangeRoleFormValues) => {
    onConfirm(values.reason);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Role Change</DialogTitle>
          {candidate && (
            <DialogDescription>
              You are changing the role for <strong>{candidate.user.name}</strong> to <Badge variant="secondary">{candidate.role.toLowerCase()}</Badge>. Please provide a reason for this action.
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
                  <FormLabel>Reason for Role Change</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., Promoting user to administrator due to new responsibilities." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" disabled={!form.formState.isValid || form.formState.isSubmitting}>
                    {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm Change
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
