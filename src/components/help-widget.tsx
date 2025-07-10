
"use client";

import * as React from 'react';
import { useSession } from 'next-auth/react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bot, User, RefreshCw } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ScrollArea } from './ui/scroll-area';

type Message = {
  id: number;
  type: 'bot' | 'human';
  text: string;
};

type Question = {
  text: string;
  answer: string;
};

const KNOWLEDGE_BASE: { general: Question[]; user: Question[]; admin: Question[] } = {
  general: [
    {
      text: 'What is S3 Commander?',
      answer: `S3 Commander is a secure web portal for managing access to AWS S3 buckets. Its main goal is to replace static, long-lived AWS credentials with a request/approval workflow for temporary, time-bound access, all while providing a full audit trail for all actions.`
    },
    {
      text: 'What do the different access levels mean?',
      answer: `Access in S3 Commander is layered. Here's how it works:

- **Read-Only Access:** This is the default permission for all buckets you can see. It allows you to browse folders and view file names, sizes, and modification dates. You cannot download or upload files.

- **Write Access (Read/Write):** This level allows you to upload new files and create folders. You can get this access in two ways:
  1. **Temporary:** By requesting and receiving approval from an Admin for a specific duration.
  2. **Permanent:** Granted by an Admin for specific buckets, or all buckets.

- **Delete Permission:** This is a separate, global permission that can only be granted permanently by an Admin. It allows you to delete files and folders, but **only in buckets where you also have Write access** (either temporary or permanent).`
    }
  ],
  user: [
    {
      text: 'How do I get write access to a bucket?',
      answer: `On the main Dashboard, find a bucket where your access is "Read-Only". Click the "Request Write" button. You will need to fill out a form explaining why you need write access and for how long. An administrator will then review your request. You can track its status in the "My Activity" section.`
    },
    {
      text: 'What is the difference between permanent and temporary access?',
      answer: `- **Temporary Access** is granted through the request/approval system. It is time-bound and expires automatically. This is the standard way to get elevated permissions.
- **Permanent Access** is granted by an administrator directly. It does not expire and is typically given for buckets you need to access regularly as part of your core duties. You can see your permanent permissions in your user profile details (visible to admins).`
    },
    {
      text: 'Where can I see my requests and file activity?',
      answer: `Click on the "My Activity" link in the sidebar. This page has three tabs:
- **Pending Requests:** Shows your active requests that are awaiting a decision.
- **Request History:** A complete history of all your past requests (approved, denied, revoked).
- **File Activity:** An audit log of your own actions, such as file uploads, downloads, and deletions.`
    },
  ],
  admin: [
    {
      text: 'How do I handle a pending access request?',
      answer: `Navigate to the "Admin Dashboard" and click the "Pending Requests" tab. Here you will see a list of all requests awaiting a decision. You can Approve or Deny each request. You must provide a clear reason for your decision, as this is recorded in the audit log for compliance.`
    },
    {
      text: 'How do I grant permanent permissions to a user?',
      answer: `1. Go to the "User Management" tab in the Admin Dashboard.
2. Click on the user you wish to manage. A dialog with their details will appear.
3. Click the "Edit Permanent Permissions" button.
4. From here, you can configure their permanent **Write Access** (to all buckets, selective buckets, or none) and toggle their global **Delete Permission**.
5. You must provide a reason for the change.`
    },
    {
      text: "How do I revoke a user's active temporary access?",
      answer: `On the "Active Permissions" tab of the Admin Dashboard, you will see all currently active temporary sessions. Click the "Revoke" button for the permission you want to terminate. This action is immediate and requires a reason for the audit log.`
    },
    {
      text: 'How do I use the audit logs effectively?',
      answer: `The "Access Logs" tab is a powerful tool. You can filter the entire history of actions in the system.
- Use the **"+ Add Filter"** button to narrow results by Event Type (e.g., show only Role Changes), a specific User, or a Date Range.
- After selecting your filters, you **must click "Apply"** for them to take effect.
- The **search bar** performs a keyword search across all log details, including user emails, bucket names, and reasons.`
    },
    {
      text: 'What is the difference between an Admin and an Owner?',
      answer: `Both Admins and Owners have full access to all buckets and can manage user permissions and requests.

The key difference is that **only the Owner** has the ability to change a user's role (i.e., promote a User to an Admin, or demote an Admin to a User). This is a critical security distinction.`
    }
  ],
};


export function HelpWidget() {
  const { data: session } = useSession();
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  
  const getInitialMessages = (): Message[] => [
    {
      id: 1,
      type: 'bot',
      text: "Hello! I'm the S3 Commander assistant. Please select a topic below.",
    }
  ];

  const [messages, setMessages] = React.useState<Message[]>(getInitialMessages());

  const handleOptionClick = (option: Question) => {
    setMessages(prev => [
      ...prev,
      { id: Date.now(), type: 'human', text: option.text },
      { id: Date.now() + 1, type: 'bot', text: option.answer },
    ]);
  };

  const handleRestart = () => {
    setMessages(getInitialMessages());
  };
  
  React.useEffect(() => {
    if (scrollAreaRef.current) {
      // Find the viewport element within the ScrollArea
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [messages]);

  if (!session) return null;

  const isAdmin = session?.user?.role === 'admin' || session?.user?.role === 'owner';

  const questionOptions = [
    ...KNOWLEDGE_BASE.general,
    ...KNOWLEDGE_BASE.user,
    ...(isAdmin ? KNOWLEDGE_BASE.admin : []),
  ];

  return (
    <Popover>
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
                 <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRestart}>
                    <RefreshCw className="h-4 w-4" />
                    <span className="sr-only">Start Over</span>
                </Button>
            </div>
            <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full" ref={scrollAreaRef}>
                <div className="p-4 space-y-4">
                    {messages.map((message) => (
                    <div key={message.id}>
                        {message.type === 'bot' && (
                        <div className="flex items-start gap-3">
                            <Avatar className="h-8 w-8 border">
                                <AvatarFallback><Bot className="h-5 w-5" /></AvatarFallback>
                            </Avatar>
                            <div className="p-3 rounded-lg bg-muted text-sm whitespace-pre-wrap font-sans break-words max-w-[85%]">{message.text}</div>
                        </div>
                        )}
                        {message.type === 'human' && (
                        <div className="flex items-start gap-3 justify-end">
                            <div className="p-3 rounded-lg bg-primary text-primary-foreground text-sm break-words max-w-[85%]">{message.text}</div>
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={session.user.image || ''} />
                                <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
                            </Avatar>
                        </div>
                        )}
                    </div>
                    ))}
                </div>
                </ScrollArea>
            </div>
            <div className="p-3 border-t">
                <ScrollArea className="h-32">
                    <div className="flex flex-col items-start gap-2 pr-2">
                        {questionOptions.map((option, index) => (
                            <Button
                                key={index}
                                variant="outline"
                                className="w-full justify-start h-auto py-2 text-left whitespace-normal"
                                onClick={() => handleOptionClick(option)}
                            >
                                {option.text}
                            </Button>
                        ))}
                    </div>
                </ScrollArea>
            </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
