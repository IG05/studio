
"use client";

import { Fragment, useMemo, useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Header } from '@/components/header';
import type { S3Object } from '@/lib/types';
import { File, Folder, HardDrive, ChevronRight, Loader2, ShieldAlert, Download, Eye } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { formatBytes } from '@/lib/utils';

type InteractingObject = {
    key: string;
    action: 'view' | 'download';
} | null;

export default function BucketPage() {
  const params = useParams();
  const slug = (params.slug || []) as string[];
  const [bucketName, ...pathParts] = slug;
  
  const [objects, setObjects] = useState<S3Object[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interactingObject, setInteractingObject] = useState<InteractingObject>(null);

  const path = useMemo(() => pathParts.join('/'), [pathParts]);

  useEffect(() => {
    if (!bucketName) return;
    
    setIsLoading(true);
    setError(null);

    const pathParam = path ? `?path=${path}/` : '';

    fetch(`/api/objects/${bucketName}${pathParam}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || `Server responded with status: ${res.status}`);
        }
        return data as S3Object[];
      })
      .then(data => {
         setObjects(data);
      })
      .catch(err => {
        console.error("Failed to fetch objects", err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [bucketName, path]);

  const breadcrumbs = useMemo(() => {
    if (!bucketName) return [];
    return [
      { name: bucketName, href: `/buckets/${bucketName}` },
      ...pathParts.map((part, i) => ({
        name: part,
        href: `/buckets/${bucketName}/${pathParts.slice(0, i + 1).join('/')}`,
      })),
    ];
  }, [bucketName, pathParts]);
  
  const currentPrefix = useMemo(() => {
    return pathParts.length > 0 ? pathParts.join('/') + '/' : '';
  }, [pathParts]);

  const getSignedUrl = async (objectKey: string, forDownload = false) => {
    const downloadQuery = forDownload ? '?for_download=true' : '';
    const res = await fetch(`/api/objects/${bucketName}/${objectKey}${downloadQuery}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to get secure link.');
    }
    return data.url;
  };

  const handleView = async (objectKey: string) => {
    setInteractingObject({ key: objectKey, action: 'view' });
    try {
      const url = await getSignedUrl(objectKey);
      window.open(url, '_blank');
    } catch (err: any) {
      console.error("View failed", err);
      toast({
        title: 'View Error',
        description: err.message || 'Could not view the file.',
        variant: 'destructive',
      });
    } finally {
      setInteractingObject(null);
    }
  };

  const handleDownload = async (objectKey: string) => {
    setInteractingObject({ key: objectKey, action: 'download' });
    try {
        const url = await getSignedUrl(objectKey, true);
        const link = document.createElement('a');
        link.href = url;
        // The download attribute is no longer strictly necessary if Content-Disposition is set by the server,
        // but it acts as a good fallback.
        link.setAttribute('download', objectKey.split('/').pop() || objectKey);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err: any) {
        console.error("Download failed", err);
        toast({
            title: 'Download Error',
            description: err.message || 'Could not download the file.',
            variant: 'destructive',
        });
    } finally {
        setInteractingObject(null);
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      <Header title="Object Browser" />
      <div className="p-4 md:p-6 flex-1 overflow-y-auto">
        <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
          <HardDrive className="w-4 h-4" />
          {breadcrumbs.map((crumb, i) => (
            <Fragment key={crumb.href}>
              <Link href={crumb.href} className="hover:text-primary font-medium">
                {crumb.name}
              </Link>
              {i < breadcrumbs.length - 1 && <ChevronRight className="w-4 h-4" />}
            </Fragment>
          ))}
        </div>

        {error && (
            <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Access Error</AlertTitle>
                <AlertDescription>
                    Could not retrieve objects. Reason: {error}
                </AlertDescription>
            </Alert>
        )}

        {!error && <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Last Modified</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center">
                    <div className="flex justify-center items-center">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <span className="ml-4">Loading objects...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : objects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    This folder is empty.
                  </TableCell>
                </TableRow>
              ) : (
                objects.map((obj) => {
                  const displayName = obj.key.substring(currentPrefix.length).replace(/\/$/, '');
                  if (!displayName) return null;
                  const isViewing = interactingObject?.key === obj.key && interactingObject?.action === 'view';
                  const isDownloading = interactingObject?.key === obj.key && interactingObject?.action === 'download';
                  
                  return (
                  <TableRow key={obj.key}>
                    <TableCell className="font-medium">
                      <Link
                        href={
                          obj.type === 'folder'
                            ? `/buckets/${bucketName}/${obj.key.slice(0,-1)}`
                            : '#'
                        }
                        className="flex items-center gap-3 group"
                      >
                        {obj.type === 'folder' ? (
                          <Folder className="w-5 h-5 text-primary" />
                        ) : (
                          <File className="w-5 h-5 text-muted-foreground" />
                        )}
                        <span className="group-hover:underline">{displayName}</span>
                      </Link>
                    </TableCell>
                    <TableCell>{obj.size ? formatBytes(obj.size) : '--'}</TableCell>
                    <TableCell>{format(parseISO(obj.lastModified), 'PPp')}</TableCell>
                    <TableCell className="text-right">
                      {obj.type === 'file' && (
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={!!interactingObject}
                                onClick={() => handleView(obj.key)}
                            >
                                {isViewing ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Eye className="w-4 h-4 mr-2" />
                                )}
                                {isViewing ? 'Opening...' : 'View'}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={!!interactingObject}
                                onClick={() => handleDownload(obj.key)}
                            >
                                {isDownloading ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Download className="w-4 h-4 mr-2" />
                                )}
                                {isDownloading ? 'Preparing...' : 'Download'}
                            </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>}
      </div>
    </div>
  );
}
