
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
        answer: "S3 Commander is a secure portal for managing access to AWS S3 buckets. It replaces the need to share long-lived credentials by allowing users to request temporary, time-limited access which administrators can approve or deny.",
    },
];

const userKnowledge: KnowledgeItem[] = [
    {
        id: 'how-to-request',
        question: 'How do I request access to a bucket?',
        answer: 'On the main dashboard, find the bucket you need. If you have "Read-Only" access, click the "Request Write" button and fill out the form with your reason and the duration you need.',
    },
    {
        id: 'check-status',
        question: 'How do I check my request status?',
        answer: 'Click on "My Activity" in the sidebar. This page has tabs for "Pending Requests" and "Request History" which list all your requests and their current status. You can click on any request to see its full details.',
    },
     {
        id: 'check-file-activity',
        question: 'How can I see my file activity?',
        answer: 'Go to the "My Activity" page from the sidebar and click on the "File Activity" tab. This will show you a history of all the files you have uploaded, downloaded, and deleted.',
    },
    {
        id: 'view-files',
        question: 'How do I browse files in a bucket?',
        answer: 'If you have access to a bucket, click its name in the sidebar or use the "Browse" button on the dashboard to view its contents.',
    },
    ...baseKnowledge,
];

const adminKnowledge: KnowledgeItem[] = [
     {
        id: 'approve-deny',
        question: 'How do I approve or deny requests?',
        answer: 'Navigate to the "Admin Dashboard". The "Pending Requests" tab lists all active requests. Use the "Approve" or "Deny" buttons. A reason is required for your decision.',
    },
    {
        id: 'grant-permanent',
        question: 'How do I grant permanent permissions?',
        answer: 'Go to the "User Management" tab on the Admin Dashboard. Click on a user to open their details dialog. At the bottom, click "Edit Permanent Permissions". This lets you assign bucket-specific write access and a global delete permission.',
    },
    {
        id: 'view-logs',
        question: 'How do I view the audit history?',
        answer: "The \"Access Logs\" tab on the \"Admin Dashboard\" provides a complete audit trail. You can use the \"+ Add Filter\" button to dynamically add filters for Event Type, User, and Date Range, then use the search bar to quickly find specific log entries.",
    },
    {
        id: 'change-role',
        question: "How do I change a user's role?",
        answer: 'From the "User Management" tab, click on a user to open their details. If you are the system Owner, you will see options at the bottom of the dialog to promote a USER to ADMIN or demote an ADMIN to USER.',
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
                                   <div className="prose prose-sm dark:prose-invert max-w-none">
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
