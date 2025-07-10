
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
import { Input } from '@/components/ui/input';
import { Loader2, FolderPlus } from 'lucide-react';

const createFolderSchema = z.object({
  folderName: z.string().min(1, 'Folder name is required.')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Folder name can only contain letters, numbers, underscores, hyphens, and periods.'),
});

type CreateFolderFormValues = z.infer<typeof createFolderSchema>;

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onCreate: (folderName: string) => void;
  isLoading: boolean;
}

export function CreateFolderDialog({ open, onOpenChange, onCreate, isLoading }: CreateFolderDialogProps) {
  const form = useForm<CreateFolderFormValues>({
    resolver: zodResolver(createFolderSchema),
    defaultValues: {
      folderName: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset();
    }
  }, [open, form]);

  const onSubmit = async (values: CreateFolderFormValues) => {
    onCreate(values.folderName);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus />
            Create New Folder
          </DialogTitle>
          <DialogDescription>
            Enter a name for the new folder. This will be created in the current directory.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <FormField
              control={form.control}
              name="folderName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Folder Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., project-files" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" disabled={!form.formState.isValid || isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Folder
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
