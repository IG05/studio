
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
import type { AppUser } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Badge } from './ui/badge';

interface ChangeRoleDialogProps {
  candidate: { user: AppUser; role: 'ADMIN' | 'USER' } | null;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: () => void;
}

export function ChangeRoleDialog({ candidate, onOpenChange, onConfirm }: ChangeRoleDialogProps) {
  const isOpen = !!candidate;
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    setIsSubmitting(true);
    onConfirm();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Role Change</DialogTitle>
          {candidate && (
            <DialogDescription>
              Are you sure you want to change the role for <strong>{candidate.user.name}</strong> to <Badge variant="secondary">{candidate.role.toLowerCase()}</Badge>? This action will be logged.
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" onClick={handleConfirm} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Change
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
