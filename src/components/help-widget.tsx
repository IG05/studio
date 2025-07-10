
"use client";

import * as React from 'react';
import { useSession } from 'next-auth/react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bot } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type KnowledgeItem = {
    id: string;
    question: string;
    answer: React.ReactNode;
}

const baseKnowledge: KnowledgeItem[] = [
    {
        id: 'what-is-s3c',
        question: "What is S3 Commander?",
        answer: <p>S3 Commander is a secure portal for managing access to AWS S3 buckets. It replaces the need for static credentials by allowing users to request temporary, time-limited access that administrators can approve or deny. It provides a full audit trail for all significant actions.</p>,
    },
    {
        id: 'access-levels',
        question: "What do the access levels mean?",
        answer: (
            <ul className="list-disc space-y-2 pl-4">
                <li><strong className="text-blue-500">Read-Only:</strong> You can browse and download files, but you cannot upload, modify, or delete anything.</li>
                <li><strong className="text-green-500">Read / Write:</strong> You have full control to browse, download, upload, create folders, and modify files.</li>
                <li><strong className="text-orange-500">Temporary Access:</strong> A timer icon next to your access level means your Write access is temporary and will expire. The expiration time is shown on the dashboard.</li>
            </ul>
        ),
    },
];

const userKnowledge: KnowledgeItem[] = [
    {
        id: 'how-to-request',
        question: 'How do I get write access to a bucket?',
        answer: <p>On the main Dashboard, find the bucket you need. If it shows "Read-Only" access, click the "Request Write" button. Fill out the form explaining why you need access and for how long. Your request will then be sent to an administrator for approval.</p>,
    },
    {
        id: 'file-operations',
        question: 'How do I upload or delete files?',
        answer: <p>First, browse to a bucket where you have "Read / Write" access. At the top of the file list, you will see buttons to "Upload" and "Create folder". To delete an object, use the trash can icon at the end of its row. Note: you may have write access (upload/modify) without having delete permissions.</p>,
    },
    {
        id: 'my-activity',
        question: 'How can I track my requests and file activity?',
        answer: <p>Click on "My Activity" in the sidebar. This page has three tabs: <strong>Pending Requests</strong> (for requests awaiting approval), <strong>Request History</strong> (for all your past approved/denied requests), and <strong>File Activity</strong> (a log of every file you have uploaded, downloaded, or deleted).</p>,
    },
    ...baseKnowledge,
];

const adminKnowledge: KnowledgeItem[] = [
     {
        id: 'approve-deny',
        question: 'How do I approve or deny requests?',
        answer: <p>Navigate to the "Admin Dashboard". The "Pending Requests" tab lists all requests awaiting a decision. Use the "Approve" or "Deny" buttons for each request. You must provide a reason for your decision, which is logged for auditing.</p>,
    },
    {
        id: 'grant-permanent',
        question: 'How do I grant permanent permissions?',
        answer: <p>Go to the "User Management" tab on the Admin Dashboard. Click on any user to view their current permissions. At the bottom of that dialog, click "Edit Permanent Permissions". This allows you to grant permanent write access (to all or selected buckets) and a separate, global permission to delete objects.</p>,
    },
    {
        id: 'view-logs',
        question: 'How do I view the audit logs?',
        answer: <p>The "Access Logs" tab on the Admin Dashboard contains a complete, real-time audit trail of all actions. You can use the "+ Add Filter" button to dynamically filter by event type, user, and date range. You can also use the search bar to find specific logs by keyword (e.g., a bucket name or reason).</p>,
    },
    {
        id: 'change-role',
        question: "How do I change a user's role?",
        answer: <p>Only the system 'Owner' can change roles. From the "User Management" tab, click a user to open their details. If you are the Owner, you will see management options at the bottom of the dialog to promote a 'USER' to 'ADMIN' or demote an 'ADMIN' to 'USER'. This action is logged.</p>,
    },
    ...baseKnowledge,
];


export function HelpWidget() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = React.useState(false);

  const isAdmin = session?.user?.role === 'admin' || session?.user?.role === 'owner';
  const knowledgeTree = isAdmin ? adminKnowledge : userKnowledge;
  
  if (!session) return null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="default"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 hover:scale-105 transition-transform animate-button-pulse"
          size="icon"
        >
          <Bot className="h-8 w-8" />
          <span className="sr-only">Help</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 sm:w-96 p-0" side="top" align="end">
        <div className="flex flex-col h-[60vh] sm:h-[70vh]">
            <div className="flex items-center justify-between p-3 border-b">
                <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8 bg-primary/20">
                        <AvatarFallback><Bot className="h-5 w-5 text-primary" /></AvatarFallback>
                    </Avatar>
                    <h4 className="font-semibold">Support Assistant</h4>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                   <p className="text-sm text-muted-foreground pb-2">
                       Hello! I'm the S3 Commander assistant. Here are some frequently asked questions.
                   </p>
                   <Accordion type="single" collapsible className="w-full">
                       {knowledgeTree.map(item => (
                           <AccordionItem key={item.id} value={item.id}>
                               <AccordionTrigger>{item.question}</AccordionTrigger>
                               <AccordionContent>
                                   <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                                        {item.answer}
                                   </div>
                               </AccordionContent>
                           </AccordionItem>
                       ))}
                   </Accordion>
                </div>
            </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
