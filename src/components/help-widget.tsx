
"use client";

import * as React from 'react';
import { useSession } from 'next-auth/react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bot, User, CornerDownLeft, Repeat } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback } from './ui/avatar';
import { cn } from '@/lib/utils';

type KnowledgeNode = {
    id: string;
    question: string;
    answer: React.ReactNode;
    isFollowUp?: boolean;
    children?: string[]; // IDs of child nodes
}

type KnowledgeTree = Record<string, KnowledgeNode>;

const KNOWLEDGE_BASE: KnowledgeTree = {
    // --- Entry Points ---
    'start': {
        id: 'start',
        question: "Start node",
        answer: "Hello! I'm the S3 Commander assistant. How can I help you today?",
        children: ['general', 'user-tasks', 'admin-tasks']
    },
    'main-menu': {
        id: 'main-menu',
        question: "Main Menu",
        answer: "Is there anything else I can help you with?",
        isFollowUp: true,
        children: ['general', 'user-tasks', 'admin-tasks']
    },

    // --- General Topics Branch ---
    'general': {
        id: 'general',
        question: "General Questions",
        answer: "Here are some general topics about S3 Commander.",
        children: ['what-is-s3c', 'access-levels']
    },
    'what-is-s3c': {
        id: 'what-is-s3c',
        question: "What is S3 Commander?",
        answer: (
            <div>
                <p>S3 Commander is a secure web portal for managing access to AWS S3 buckets.</p>
                <p className="mt-2">Its primary purpose is to replace the need for static, long-lived AWS credentials by implementing a robust <strong>request and approval workflow</strong> for temporary, time-bound access. It provides a full audit trail for compliance and security.</p>
            </div>
        ),
        children: ['main-menu']
    },
    'access-levels': {
        id: 'access-levels',
        question: "What do the access levels mean?",
        answer: (
             <ul className="space-y-3">
                <li className="flex items-start gap-3">
                    <strong className="text-blue-500 whitespace-nowrap">Read-Only:</strong>
                    <span>You can view and browse bucket contents and download files. You cannot upload, modify, or delete anything.</span>
                </li>
                <li className="flex items-start gap-3">
                    <strong className="text-green-500 whitespace-nowrap">Read/Write:</strong>
                    <span>You can browse, download, upload, create folders, and modify files. This can be a permanent permission set by an admin, or a temporary one you requested.</span>
                </li>
                 <li className="flex items-start gap-3">
                    <strong className="text-destructive whitespace-nowrap">Delete:</strong>
                    <span>This is a separate, permanent permission that allows you to delete files and folders. It is only active in buckets where you also have Write access.</span>
                </li>
                <li className="flex items-start gap-3">
                    <strong className="text-orange-500 whitespace-nowrap">Temporary:</strong>
                    <span>A timer icon next to your access level means your Write access is temporary and will expire.</span>
                </li>
            </ul>
        ),
        children: ['main-menu']
    },

    // --- User Tasks Branch ---
    'user-tasks': {
        id: 'user-tasks',
        question: "User Tasks",
        answer: "What would you like to know about performing user tasks?",
        children: ['how-to-request', 'file-operations', 'my-activity']
    },
    'how-to-request': {
        id: 'how-to-request',
        question: 'How do I get write access to a bucket?',
        answer: <p>On the main Dashboard, find the bucket you need. If it shows "Read-Only" access, click the "Request Write" button. Fill out the form explaining why you need access and for how long. Your request will then be sent to an administrator for approval.</p>,
        children: ['user-tasks', 'main-menu']
    },
    'file-operations': {
        id: 'file-operations',
        question: 'How do I upload or delete files?',
        answer: (
            <div>
                <p>First, browse to a bucket where you have "Read/Write" access. At the top of the file list, you will see buttons to "Upload" and "Create folder".</p>
                <p className="mt-2">To delete an object, you must have the specific "Delete" permission granted by an admin. If you do, you can use the trash can icon at the end of its row.</p>
            </div>
        ),
        children: ['user-tasks', 'main-menu']
    },
    'my-activity': {
        id: 'my-activity',
        question: 'How can I track my activity?',
        answer: <p>Click on "My Activity" in the sidebar. This page has three tabs: <strong>Pending Requests</strong> (for requests awaiting approval), <strong>Request History</strong> (for all your past approved/denied requests), and <strong>File Activity</strong> (a log of every file you have uploaded, downloaded, or deleted).</p>,
        children: ['user-tasks', 'main-menu']
    },

    // --- Admin Tasks Branch ---
    'admin-tasks': {
        id: 'admin-tasks',
        question: "Admin Tasks",
        answer: "What do you need help with as an Admin?",
        children: ['approve-deny', 'grant-permanent', 'view-logs', 'change-role']
    },
    'approve-deny': {
        id: 'approve-deny',
        question: 'How do I approve or deny requests?',
        answer: <p>Navigate to the "Admin Dashboard". The "Pending Requests" tab lists all requests awaiting a decision. Use the "Approve" or "Deny" buttons for each request. You must provide a reason for your decision, which is logged for auditing.</p>,
        children: ['admin-tasks', 'main-menu']
    },
    'grant-permanent': {
        id: 'grant-permanent',
        question: 'How do I grant permanent permissions?',
        answer: <p>Go to the "User Management" tab on the Admin Dashboard. Click on any user to view their current permissions. In the dialog, click "Edit Permanent Permissions". This allows you to grant permanent write access (to all or selected buckets) and a separate, global permission to delete objects.</p>,
        children: ['admin-tasks', 'main-menu']
    },
    'view-logs': {
        id: 'view-logs',
        question: 'How do I view the audit logs?',
        answer: <p>The "Access Logs" tab on the Admin Dashboard contains a complete, real-time audit trail. Use the "+ Add Filter" button to dynamically filter by event type, user, and date range. You can also use the search bar to find specific logs by keyword (e.g., a bucket name or reason).</p>,
        children: ['admin-tasks', 'main-menu']
    },
    'change-role': {
        id: 'change-role',
        question: "How do I change a user's role?",
        answer: <p>Only the system 'Owner' can change roles. From the "User Management" tab, click a user to open their details. You will see management options at the bottom of the dialog to promote a 'USER' to 'ADMIN' or demote an 'ADMIN' to 'USER'.</p>,
        children: ['admin-tasks', 'main-menu']
    },
};

type ChatMessage = {
    id: number;
    type: 'bot' | 'user';
    content: React.ReactNode;
    options?: KnowledgeNode[];
}

export function HelpWidget() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = React.useState(false);
  const [chatHistory, setChatHistory] = React.useState<ChatMessage[]>([]);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  
  const isAdmin = session?.user?.role === 'admin' || session?.user?.role === 'owner';

  const resetConversation = React.useCallback(() => {
    const startNode = KNOWLEDGE_BASE['start'];
    let initialOptions = startNode.children?.map(id => KNOWLEDGE_BASE[id]) || [];

    if (!isAdmin) {
      initialOptions = initialOptions.filter(opt => opt.id !== 'admin-tasks');
    }
    
    setChatHistory([{
        id: Date.now(),
        type: 'bot',
        content: startNode.answer,
        options: initialOptions,
    }]);
  }, [isAdmin]);

  // Start the conversation when the popover opens
  React.useEffect(() => {
    if (isOpen) {
      resetConversation();
    }
  }, [isOpen, resetConversation]);

  // Auto-scroll to the bottom of the chat
  React.useEffect(() => {
    if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleOptionClick = (nodeId: string) => {
    const userSelectedNode = KNOWLEDGE_BASE[nodeId];
    const botResponseNode = KNOWLEDGE_BASE[nodeId];

    // Add user's choice to chat history
    const userMessage: ChatMessage = {
        id: Date.now(),
        type: 'user',
        content: userSelectedNode.question,
    };

    let botOptions = botResponseNode.children?.map(id => KNOWLEDGE_BASE[id]) || [];
    if (!isAdmin) {
      botOptions = botOptions.filter(opt => opt.id !== 'admin-tasks');
    }

    // Add bot's response to chat history
    const botMessage: ChatMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: botResponseNode.answer,
        options: botOptions,
    };
    
    setChatHistory(prev => [...prev, userMessage, botMessage]);
  };
  
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
                 <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetConversation}>
                    <Repeat className="h-4 w-4" />
                    <span className="sr-only">Start Over</span>
                </Button>
            </div>

            <ScrollArea className="flex-1" ref={scrollAreaRef}>
                <div className="p-4 space-y-4">
                  {chatHistory.map(message => (
                    <div key={message.id} className={cn("flex items-start gap-3", message.type === 'user' && "justify-end")}>
                        {message.type === 'bot' && (
                            <Avatar className="h-7 w-7 bg-muted">
                                <AvatarFallback><Bot className="h-4 w-4 text-muted-foreground" /></AvatarFallback>
                            </Avatar>
                        )}
                        <div className={cn(
                            "rounded-lg p-3 max-w-[85%] text-sm", 
                            message.type === 'bot' ? 'bg-muted' : 'bg-primary text-primary-foreground'
                        )}>
                            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-0">
                                {message.content}
                            </div>
                        </div>
                        {message.type === 'user' && (
                             <Avatar className="h-7 w-7 bg-muted">
                                <AvatarFallback><User className="h-4 w-4 text-muted-foreground" /></AvatarFallback>
                            </Avatar>
                        )}
                    </div>
                  ))}
                </div>
            </ScrollArea>

            <div className="p-2 border-t bg-background">
                <div className="flex flex-col gap-2">
                    {chatHistory[chatHistory.length - 1]?.options?.map(option => (
                        <Button
                            key={option.id}
                            variant={option.isFollowUp ? "secondary" : "outline"}
                            className="justify-start h-auto py-2"
                            onClick={() => handleOptionClick(option.id)}
                        >
                           <CornerDownLeft className="mr-2 h-4 w-4 shrink-0" />
                           <span className="text-left whitespace-normal">{option.question}</span>
                        </Button>
                    ))}
                </div>
            </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
