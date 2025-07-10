
"use client";

import { Fragment, useMemo, useState, useEffect, useRef } from 'react';
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
import { File, Folder, HardDrive, ChevronRight, Loader2, ShieldAlert, Download, Eye, Upload, Trash2, FolderPlus, Search, FileUp, FolderUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { formatBytes } from '@/lib/utils';
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
} from "@/components/ui/alert-dialog"
import { CreateFolderDialog } from '@/components/create-folder-dialog';
import { ViewObjectDialog } from '@/components/view-object-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { AlertDialogTrigger } from '@radix-ui/react-alert-dialog';


type InteractingObject = {
    key: string;
    action: 'view' | 'download' | 'delete' | 'upload' | 'create-folder';
} | null;

type UploadProgress = {
    fileName: string;
    totalFiles: number;
    currentFileNumber: number;
    overallProgress: number;
    individualProgress: number;
};

const VIEWABLE_EXTENSIONS = ['json', 'txt', 'md', 'csv', 'xml', 'html', 'css', 'js', 'ts', 'log'];

export default function BucketPage() {
  const params = useParams();
  const slug = (params.slug || []) as string[];
  const [bucketName, ...pathParts] = slug;
  
  const [objects, setObjects] = useState<S3Object[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interactingObject, setInteractingObject] = useState<InteractingObject>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [viewingObject, setViewingObject] = useState<{ bucket: string, key: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedObjects, setSelectedObjects] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  
  const path = useMemo(() => pathParts.join('/'), [pathParts]);
  const currentPrefix = useMemo(() => (path ? path + '/' : ''), [path]);

  const fetchObjects = () => {
    if (!bucketName) return;
    
    setIsLoading(true);
    setError(null);

    const pathParam = path ? `?path=${encodeURIComponent(currentPrefix)}` : '';

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

  const filteredObjects = useMemo(() => {
    return objects.filter(obj => obj.key.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [objects, searchQuery]);
  
  const getSignedUrl = async (objectKey: string, forDownload = false) => {
    const downloadQuery = forDownload ? '?for_download=true' : '';
    const res = await fetch(`/api/objects/${bucketName}/${encodeURIComponent(objectKey)}${downloadQuery}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to get secure link.');
    }
    return data.url;
  };

  const handleView = async (objectKey: string) => {
    setInteractingObject({ key: objectKey, action: 'view' });
    try {
        const fileExtension = objectKey.split('.').pop()?.toLowerCase();
        if (fileExtension && VIEWABLE_EXTENSIONS.includes(fileExtension)) {
            setViewingObject({ bucket: bucketName, key: objectKey });
        } else {
            const url = await getSignedUrl(objectKey);
            window.open(url, '_blank');
        }
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
      const res = await fetch(`/api/objects/${bucketName}/${encodeURIComponent(objectKey)}`, {
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

  const handleDeleteSelected = async () => {
    const itemsToDelete = [...selectedObjects];
    setInteractingObject({ key: 'multiple', action: 'delete' });
    try {
      await Promise.all(
        itemsToDelete.map(key =>
          fetch(`/api/objects/${bucketName}/${encodeURIComponent(key)}`, { method: 'DELETE' }).then(res => {
            if (!res.ok) throw new Error(`Failed to delete ${key}`);
          })
        )
      );
      toast({
        title: "Objects Deleted",
        description: `Successfully deleted ${itemsToDelete.length} items.`,
      });
      fetchObjects();
      setSelectedObjects([]);
    } catch (err: any) {
      console.error("Multi-delete failed", err);
      toast({
        title: "Delete Error",
        description: "Some objects could not be deleted.",
        variant: "destructive",
      });
    } finally {
      setInteractingObject(null);
    }
  };

  const uploadFileWithProgress = (url: string, file: File, onProgress: (progress: number) => void) => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url, true);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percentComplete = (event.loaded / event.total) * 100;
                onProgress(percentComplete);
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                onProgress(100);
                resolve(xhr.response);
            } else {
                reject(new Error(`Upload failed with status: ${xhr.status} ${xhr.statusText}`));
            }
        };

        xhr.onerror = () => {
            reject(new Error('Upload failed due to a network error.'));
        };

        xhr.send(file);
    });
  }

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setUploadProgress({
        fileName: files[0].name,
        totalFiles: files.length,
        currentFileNumber: 1,
        overallProgress: 0,
        individualProgress: 0,
    });

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // webkitRelativePath is a browser-specific property for folder uploads
        const relativePath = (file as any).webkitRelativePath || file.name;
        const key = `${currentPrefix}${relativePath}`;
        
        if ((file as any).webkitRelativePath && file.size === 0 && !key.endsWith('/')) {
            // Skip dummy zero-byte files that some browsers create for folders
            // but ensure we still try to create the folder if needed
             try {
                await handleCreateFolder(relativePath.substring(0, relativePath.lastIndexOf('/') + 1), true);
            } catch (e) {
                 // May fail if folder already exists, which is fine
            }
            continue;
        }

        setUploadProgress(prev => ({
            ...prev!,
            fileName: file.name,
            currentFileNumber: i + 1,
            overallProgress: (i / files.length) * 100,
            individualProgress: 0
        }));

        try {
            // Get presigned URL
            const presignedRes = await fetch(`/api/objects/${bucketName}/${encodeURIComponent(key)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contentType: file.type || 'application/octet-stream' }),
            });

            if (!presignedRes.ok) {
                const data = await presignedRes.json();
                throw new Error(data.error || `Could not get upload URL for ${file.name}.`);
            }
            const { url } = await presignedRes.json();

            // Upload the actual file to the received presigned URL with progress tracking
            await uploadFileWithProgress(url, file, (progress) => {
                 setUploadProgress(prev => prev ? ({ ...prev, individualProgress: progress }) : null);
            });

        } catch (err: any) {
            console.error(err);
            toast({ title: 'Upload Error', description: err.message, variant: 'destructive' });
            setUploadProgress(null); // Stop on first error
            return;
        }
    }
    
    setUploadProgress(null);
    toast({ title: "Upload Complete", description: `${files.length} file(s) uploaded successfully.` });
    
    if(fileInputRef.current) fileInputRef.current.value = "";
    if(folderInputRef.current) folderInputRef.current.value = "";

    fetchObjects();
  };

  const handleCreateFolder = async (folderName: string, fromUpload = false) => {
      const key = folderName.endsWith('/') ? `${currentPrefix}${folderName}` : `${currentPrefix}${folderName}/`;
      setInteractingObject({ key, action: 'create-folder'});

      try {
          const res = await fetch(`/api/objects/${bucketName}/${encodeURIComponent(key)}`, {
              method: 'PUT',
          });
          if (!res.ok) {
              let errorMsg = "Could not create folder.";
              try {
                  const errorData = await res.json();
                  errorMsg = errorData.error || errorMsg;
              } catch (e) {
                   console.log("Response for create folder was not JSON.", await res.text());
              }
              throw new Error(errorMsg);
          }
          if (!fromUpload) {
            toast({ title: "Folder Created", description: `Folder "${folderName}" created successfully.` });
            fetchObjects();
          }
      } catch (err: any) {
          console.error("Create folder failed", err);
          if (!fromUpload) {
            toast({
                title: 'Create Folder Error',
                description: err.message || 'Could not create the folder.',
                variant: 'destructive',
            });
          } else {
             // Silently fail if creating a folder during an upload fails
             // (e.g., it likely already exists, which is fine)
             console.warn(`Could not create folder structure during upload: ${key}`);
          }
      } finally {
          setInteractingObject(null);
      }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedObjects(filteredObjects.map(obj => obj.key));
    } else {
      setSelectedObjects([]);
    }
  };

  const handleSelectObject = (key: string, checked: boolean) => {
    if (checked) {
      setSelectedObjects(prev => [...prev, key]);
    } else {
      setSelectedObjects(prev => prev.filter(k => k !== key));
    }
  };

  const isAllSelected = selectedObjects.length > 0 && selectedObjects.length === filteredObjects.length;
  const isIndeterminate = selectedObjects.length > 0 && selectedObjects.length < filteredObjects.length;

  return (
    <>
    <CreateFolderDialog
      open={isCreateFolderOpen}
      onOpenChange={setIsCreateFolderOpen}
      onCreate={handleCreateFolder}
      isLoading={interactingObject?.action === 'create-folder'}
    />
    <ViewObjectDialog
        objectInfo={viewingObject}
        onOpenChange={(isOpen) => !isOpen && setViewingObject(null)}
    />
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

        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
            <h2 className="text-2xl font-bold tracking-tight">Objects ({objects.length})</h2>
            {canWrite && (
              <div className="flex items-center gap-2">
                <Button onClick={() => setIsCreateFolderOpen(true)} variant="outline">
                    <FolderPlus className="w-4 h-4 mr-2" /> Create folder
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="default">
                            <Upload className="w-4 h-4 mr-2" /> Upload
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
                            <FileUp className="w-4 h-4 mr-2" /> Upload file(s)
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => folderInputRef.current?.click()}>
                            <FolderUp className="w-4 h-4 mr-2" /> Upload folder
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <input type="file" ref={fileInputRef} className="hidden" multiple onChange={(e) => uploadFiles(e.target.files)} />
                <input type="file" ref={folderInputRef} className="hidden" multiple onChange={(e) => uploadFiles(e.target.files)} {...{ webkitdirectory: "true" }} />
              </div>
            )}
        </div>

        <Separator className="mb-4" />
        
        {error && (
            <Alert variant="destructive" className="my-4">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Access Error</AlertTitle>
                <AlertDescription>
                    Could not retrieve objects. Reason: {error}
                </AlertDescription>
            </Alert>
        )}

        {uploadProgress && (
            <div className="my-4 p-4 border rounded-lg bg-muted space-y-2">
                <div className="flex justify-between items-center mb-1">
                    <p className="text-sm font-medium">
                        Overall Progress ({uploadProgress.currentFileNumber}/{uploadProgress.totalFiles})
                    </p>
                    <p className="text-sm text-muted-foreground">{Math.round(uploadProgress.overallProgress)}%</p>
                </div>
                <Progress value={uploadProgress.overallProgress} />

                 <div className="flex justify-between items-center mb-1 pt-2">
                    <p className="text-sm font-medium truncate pr-4">
                       Uploading: {uploadProgress.fileName}
                    </p>
                    <p className="text-sm text-muted-foreground">{Math.round(uploadProgress.individualProgress)}%</p>
                </div>
                <Progress value={uploadProgress.individualProgress} className="h-2" />
            </div>
        )}

        <div className="my-4 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Find objects by prefix" className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            {selectedObjects.length > 0 && canWrite && (
                <div className="flex items-center gap-2">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={!!interactingObject}>
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete ({selectedObjects.length})
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will permanently delete the selected {selectedObjects.length} item(s). This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteSelected}>
                                    {interactingObject?.action === 'delete' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Confirm Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            )}
        </div>

        {!error && <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox 
                    checked={isAllSelected}
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    aria-label="Select all"
                    data-state={isIndeterminate ? 'indeterminate' : isAllSelected ? 'checked' : 'unchecked'}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead>Last Modified</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex justify-center items-center">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <span className="ml-4">Loading objects...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredObjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    {searchQuery ? 'No objects match your search.' : 'This folder is empty.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredObjects.map((obj) => {
                  const displayName = obj.key.substring(currentPrefix.length).replace(/\/$/, '');
                  if (!displayName) return null;
                  const isInteracting = !!interactingObject;
                  const fileType = obj.type === 'file' ? obj.key.split('.').pop() || 'file' : 'Folder';

                  return (
                  <TableRow key={obj.key} data-state={selectedObjects.includes(obj.key) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedObjects.includes(obj.key)}
                        onCheckedChange={(checked) => handleSelectObject(obj.key, !!checked)}
                        aria-label={`Select ${displayName}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={
                          obj.type === 'folder'
                            ? `/buckets/${bucketName}/${obj.key.slice(0,-1)}`
                            : '#'
                        }
                        className="flex items-center gap-3 group"
                        onClick={(e) => { if (obj.type === 'file') { e.preventDefault(); handleView(obj.key); } }}
                      >
                        {obj.type === 'folder' ? (
                          <Folder className="w-5 h-5 text-primary" />
                        ) : (
                          <File className="w-5 h-5 text-muted-foreground" />
                        )}
                        <span className={cn("group-hover:underline")}>{displayName}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{fileType}</TableCell>
                    <TableCell>{format(parseISO(obj.lastModified), 'PPp')}</TableCell>
                    <TableCell>{obj.size != null ? formatBytes(obj.size) : '--'}</TableCell>
                    <TableCell className="text-right">
                      {obj.type === 'file' && (
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                title="Download"
                                disabled={isInteracting}
                                onClick={() => handleDownload(obj.key)}
                            >
                                {interactingObject?.key === obj.key && interactingObject.action === 'download' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
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
    </>
  );
}
