
"use client";

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Loader2, FileText } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';

interface ViewObjectDialogProps {
  objectInfo: { bucket: string, key: string } | null;
  onOpenChange: (isOpen: boolean) => void;
}

export function ViewObjectDialog({ objectInfo, onOpenChange }: ViewObjectDialogProps) {
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isOpen = !!objectInfo;

  useEffect(() => {
    if (objectInfo) {
      setIsLoading(true);
      setContent(null);
      fetch(`/api/objects/${objectInfo.bucket}/${objectInfo.key}?for_viewer=true`)
        .then(async res => {
          if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || "Failed to fetch file content.");
          }
          return res.text();
        })
        .then(data => {
            const fileExtension = objectInfo.key.split('.').pop()?.toLowerCase();
            if(fileExtension === 'json') {
                try {
                    // Prettify JSON content
                    const parsedJson = JSON.parse(data);
                    setContent(JSON.stringify(parsedJson, null, 2));
                } catch (e) {
                    setContent(data); // Fallback to raw text if JSON parsing fails
                }
            } else {
                 setContent(data);
            }
        })
        .catch(err => {
          console.error("Failed to fetch object content", err);
          toast({
            title: "Error",
            description: err.message || "Could not fetch file content.",
            variant: "destructive",
          });
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [objectInfo]);

  const handleCopyToClipboard = () => {
    if (content) {
        navigator.clipboard.writeText(content).then(() => {
            toast({ title: "Copied to clipboard!" });
        }, (err) => {
            toast({ title: "Failed to copy", description: "Could not copy content to clipboard.", variant: "destructive" });
        });
    }
  }

  const filename = objectInfo?.key.split('/').pop();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl flex flex-col h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText />
            File Content Viewer
          </DialogTitle>
          {objectInfo && (
            <DialogDescription>
              Viewing <span className="font-semibold text-primary">{filename}</span> from bucket <span className="font-semibold text-primary">{objectInfo.bucket}</span>.
            </DialogDescription>
          )}
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden relative border rounded-md">
            {isLoading ? (
                <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <ScrollArea className="h-full w-full">
                    <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words">
                        <code>{content ?? 'No content or file is empty.'}</code>
                    </pre>
                </ScrollArea>
            )}
        </div>
        <div className="flex justify-end pt-4">
            <Button onClick={handleCopyToClipboard} disabled={!content}>Copy Content</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
