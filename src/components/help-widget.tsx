
"use client";

import * as React from 'react';
import { useSession } from 'next-auth/react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bot, User, MessageSquare, BrainCircuit, RefreshCw } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';

type Message = {
  id: number;
  type: 'bot' | 'human' | 'options';
  text?: string;
  options?: { text: string; answer: string }[];
};

const KNOWLEDGE_BASE = {
  general: [
    {
      text: 'What is S3 Commander?',
      answer: "S3 Commander is a secure web portal for managing access to AWS S3 buckets. Its main goal is to replace static, long-lived AWS credentials with a request/approval workflow for temporary, time-bound access, all while providing a full audit trail."
    },
    {
      text: 'What do the access levels mean?',
      answer: `- **Read-Only:** You can view bucket contents and download files.\n- **Read/Write:** You can browse, download, upload, create folders, and modify files. This can be permanent or temporary.\n- **Delete Permission:** This is a separate, permanent permission that allows you to delete files and folders, but only in buckets where you also have Write access.`
    }
  ],
  user: [
    {
      text: 'How do I get write access?',
      answer: 'On the main Dashboard, find a bucket where you have "Read-Only" access and click the "Request Write" button. Fill out the form explaining why you need access and for how long. An administrator will then review your request.'
    },
    {
      text: 'How do I upload or delete files?',
      answer: 'First, browse to a bucket where you have "Read/Write" access. Use the "Upload" and "Create folder" buttons at the top of the file list. To delete, you must have the specific "Delete" permission granted by an admin. If you do, the trash can icon will be enabled on files and folders.'
    },
    {
      text: 'Where can I see my requests and activity?',
      answer: 'Click on "My Activity" in the sidebar. This page has tabs for your pending requests, your full request history, and a log of all your file uploads, downloads, and deletions.'
    },
  ],
  admin: [
    {
      text: 'How do I handle access requests?',
      answer: 'In the "Admin Dashboard", go to the "Pending Requests" tab. You can approve or deny requests from there. You must provide a reason for your decision, which is logged for auditing.'
    },
    {
      text: 'How do I grant permanent permissions?',
      answer: 'Go to the "User Management" tab, click on a user, and then click "Edit Permanent Permissions" in the dialog that appears. This lets you grant permanent write access (to all or specific buckets) and the global permission to delete objects.'
    },
    {
      text: 'How do I use the audit logs?',
      answer: 'The "Access Logs" tab on the Admin Dashboard contains a complete audit trail. Use the "+ Add Filter" button to filter by event type, user, and date. You can also use the search bar to find logs by keywords like a bucket name, user email, or reason.'
    },
    {
      text: 'How do I change a user\'s role?',
      answer: 'Only the system \'Owner\' can change roles. From the "User Management" tab, click a user to open their details, where you will find options to promote a \'USER\' to \'ADMIN\' or demote an \'ADMIN\' to \'USER\'.'
    }
  ],
};


export function HelpWidget() {
  const { data: session } = useSession();
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  const isAdmin = session?.user?.role === 'admin' || session?.user?.role === 'owner';
  
  const getInitialMessage = (): Message => ({
    id: 1,
    type: 'options',
    text: "Hello! I'm the S3 Commander assistant. Please select a topic below.",
    options: [
        ...KNOWLEDGE_BASE.general,
        ...KNOWLEDGE_BASE.user,
        ...(isAdmin ? KNOWLEDGE_BASE.admin : []),
    ]
  });

  const [messages, setMessages] = React.useState<Message[]>([getInitialMessage()]);

  const handleOptionClick = (option: { text: string; answer: string }) => {
    setMessages(prev => [
      ...prev.filter(m => m.type !== 'options'), // Remove old options
      { id: Date.now(), type: 'human', text: option.text },
      { id: Date.now() + 1, type: 'bot', text: option.answer },
      getInitialMessage(), // Add new options
    ]);
  };

  const handleRestart = () => {
    setMessages([getInitialMessage()]);
  };

  React.useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  if (!session) return null;

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
            <ScrollArea className="flex-1" ref={scrollAreaRef}>
              <div className="p-4 space-y-4">
                {messages.map((message) => (
                  <div key={message.id}>
                    {message.type === 'bot' && (
                       <div className="flex items-start gap-3">
                         <Avatar className="h-8 w-8 border">
                            <AvatarFallback><Bot className="h-5 w-5" /></AvatarFallback>
                         </Avatar>
                         <div className="p-3 rounded-lg bg-muted text-sm whitespace-pre-wrap font-sans">{message.text}</div>
                       </div>
                    )}
                     {message.type === 'human' && (
                       <div className="flex items-start gap-3 justify-end">
                         <div className="p-3 rounded-lg bg-primary text-primary-foreground text-sm">{message.text}</div>
                         <Avatar className="h-8 w-8">
                            <AvatarImage src={session.user.image || ''} />
                            <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
                         </Avatar>
                       </div>
                    )}
                    {message.type === 'options' && (
                      <>
                        {message.text && (
                           <div className="flex items-start gap-3">
                            <Avatar className="h-8 w-8 border">
                                <AvatarFallback><Bot className="h-5 w-5" /></AvatarFallback>
                            </Avatar>
                            <div className="p-3 rounded-lg bg-muted text-sm">{message.text}</div>
                          </div>
                        )}
                        <div className="flex flex-col items-end gap-2 pt-2">
                            {message.options?.map((option, index) => (
                                <Button
                                    key={index}
                                    variant="outline"
                                    className="w-full justify-start h-auto py-2"
                                    onClick={() => handleOptionClick(option)}
                                >
                                    {option.text}
                                </Button>
                            ))}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
