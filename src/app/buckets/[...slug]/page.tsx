
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
import { File, Folder, HardDrive, ChevronRight, Loader2, ShieldAlert, Download, Eye, Upload, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { formatBytes } from '@/lib/utils';
import { useSession } from 'next-auth/react';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

type InteractingObject = {
    key: string;
    action: 'view' | 'download' | 'delete' | 'upload';
} | null;

export default function BucketPage() {
  const params = useParams();
  const { data: session } = useSession();
  const slug = (params.slug || []) as string[];
  const [bucketName, ...pathParts] = slug;
  
  const [objects, setObjects] = useState<S3Object[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interactingObject, setInteractingObject] = useState<InteractingObject>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const path = useMemo(() => pathParts.join('/'), [pathParts]);
  const currentPrefix = useMemo(() => (path ? path + '/' : ''), [path]);

  const fetchObjects = () => {
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
        setCanWrite(res.headers.get('X-S3-Commander-Write-Access') === 'true');
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
  };

  useEffect(() => {
    fetchObjects();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleDelete = async (objectKey: string) => {
    setInteractingObject({ key: objectKey, action: 'delete' });
    try {
      const res = await fetch(`/api/objects/${bucketName}/${objectKey}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete object.");
      }
      toast({ title: "Object Deleted", description: `Successfully deleted ${objectKey}` });
      fetchObjects(); // Refresh the list
    } catch (err: any) {
       console.error("Delete failed", err);
        toast({
            title: 'Delete Error',
            description: err.message || 'Could not delete the file.',
            variant: 'destructive',
        });
    } finally {
      setInteractingObject(null);
    }
  }

  const handleUpload = async () => {
    if (!uploadFile) return;

    setInteractingObject({ key: uploadFile.name, action: 'upload' });

    try {
        const key = `${currentPrefix}${uploadFile.name}`;
        // Get a presigned URL for upload
        const presignedRes = await fetch(`/api/objects/${bucketName}/${key}?upload=true`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contentType: uploadFile.type })
        });

        if (!presignedRes.ok) {
            const data = await presignedRes.json();
            throw new Error(data.error || "Could not get an upload URL.");
        }

        const { url } = await presignedRes.json();

        // Upload the file directly to S3 using the presigned URL
        const uploadRes = await fetch(url, {
            method: 'PUT',
            body: uploadFile,
            headers: { 'Content-Type': uploadFile.type },
        });

        if (!uploadRes.ok) {
            throw new Error("File upload to S3 failed.");
        }

        toast({ title: "Upload Successful", description: `File ${uploadFile.name} uploaded.` });
        setUploadFile(null);
        fetchObjects(); // Refresh list

    } catch (err: any) {
        console.error("Upload failed", err);
        toast({
            title: 'Upload Error',
            description: err.message || 'Could not upload the file.',
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
        <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
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

        {canWrite && (
            <div className="bg-muted p-4 rounded-lg mb-6 flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1">
                    <label htmlFor="file-upload" className="font-semibold text-foreground">Upload a file</label>
                    <p className="text-sm text-muted-foreground">Select a file to upload to the current folder.</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Input id="file-upload" type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} className="flex-1" />
                    <Button onClick={handleUpload} disabled={!uploadFile || interactingObject?.action === 'upload'}>
                        {interactingObject?.action === 'upload' ? (
                             <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Upload className="w-4 h-4 mr-2" />
                        )}
                        Upload
                    </Button>
                </div>
            </div>
        )}

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
                  const isDeleting = interactingObject?.key === obj.key && interactingObject?.action === 'delete';
                  
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
                                {isViewing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
                                {isViewing ? 'Opening...' : 'View'}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={!!interactingObject}
                                onClick={() => handleDownload(obj.key)}
                            >
                                {isDownloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                                {isDownloading ? 'Preparing...' : 'Download'}
                            </Button>
                            {canWrite && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="sm" disabled={!!interactingObject}>
                                            {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                            Delete
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This action cannot be undone. This will permanently delete the file <span className="font-bold">{displayName}</span>.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(obj.key)}>Continue</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
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
