
"use client";

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Loader2, FileText, Download } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';

interface ViewObjectDialogProps {
  objectInfo: { bucket: string, key: string } | null;
  onOpenChange: (isOpen: boolean) => void;
}

const VIEWABLE_EXTENSIONS = ['json', 'txt', 'md', 'csv', 'xml', 'html', 'css', 'js', 'ts', 'log', 'pdf'];

export function ViewObjectDialog({ objectInfo, onOpenChange }: ViewObjectDialogProps) {
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPdf, setIsPdf] = useState(false);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const isOpen = !!objectInfo;
  
  const fileExtension = objectInfo?.key.split('.').pop()?.toLowerCase();
  const filename = objectInfo?.key.split('/').pop();

  useEffect(() => {
    if (objectInfo) {
      setIsLoading(true);
      setContent(null);
      setViewUrl(null);
      setIsPdf(false);

      if (fileExtension === 'pdf') {
        setIsPdf(true);
        fetch(`/api/objects/${objectInfo.bucket}/${encodeURIComponent(objectInfo.key)}`)
          .then(async res => {
              if (!res.ok) throw await res.json();
              return res.json();
          })
          .then(data => setViewUrl(data.url))
          .catch(err => {
              toast({ title: "Error", description: err.error || "Could not load PDF.", variant: "destructive" });
          })
          .finally(() => setIsLoading(false));

      } else if (fileExtension && VIEWABLE_EXTENSIONS.includes(fileExtension)) {
        fetch(`/api/objects/${objectInfo.bucket}/${encodeURIComponent(objectInfo.key)}?for_viewer=true`)
          .then(async res => {
            if (!res.ok) {
              const error = await res.json();
              throw new Error(error.error || "Failed to fetch file content.");
            }
            return res.text();
          })
          .then(data => {
              if(fileExtension === 'json') {
                  try {
                      const parsedJson = JSON.parse(data);
                      setContent(JSON.stringify(parsedJson, null, 2));
                  } catch (e) {
                      setContent(data);
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
      } else {
          setIsLoading(false);
      }
    }
  }, [objectInfo, fileExtension]);

  const handleCopyToClipboard = () => {
    if (content) {
        navigator.clipboard.writeText(content).then(() => {
            toast({ title: "Copied to clipboard!" });
        }, (err) => {
            toast({ title: "Failed to copy", description: "Could not copy content to clipboard.", variant: "destructive" });
        });
    }
  }

  const handleDownload = async () => {
    if (!objectInfo) return;
    try {
        const res = await fetch(`/api/objects/${objectInfo.bucket}/${encodeURIComponent(objectInfo.key)}?for_download=true`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        const link = document.createElement('a');
        link.href = data.url;
        link.setAttribute('download', filename || 'download');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch(err: any) {
        toast({ title: "Download Error", description: err.message || 'Could not download the file.', variant: 'destructive'});
    }
  }

  const renderContent = () => {
    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (isPdf) {
        return viewUrl ? <iframe src={viewUrl} className="h-full w-full" title={filename} /> : <p>Could not load PDF.</p>;
    }

    return (
        <ScrollArea className="h-full w-full">
            <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words">
                <code>{content ?? 'No content or file is empty.'}</code>
            </pre>
        </ScrollArea>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl flex flex-col h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText />
            File Viewer
          </DialogTitle>
          {objectInfo && (
            <DialogDescription>
              Viewing <span className="font-semibold text-primary">{filename}</span> from bucket <span className="font-semibold text-primary">{objectInfo.bucket}</span>.
            </DialogDescription>
          )}
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden relative border rounded-md bg-muted/20">
            {renderContent()}
        </div>
        <DialogFooter className="pt-4 flex sm:justify-between">
            <Button onClick={handleDownload} variant="secondary">
                <Download className="mr-2 h-4 w-4" />
                Download File
            </Button>
            {!isPdf && (
              <Button onClick={handleCopyToClipboard} disabled={!content}>Copy Content</Button>
            )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
