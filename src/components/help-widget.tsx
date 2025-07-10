
"use client";

import * as React from 'react';
import { useSession } from 'next-auth/react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bot, User as UserIcon, RotateCw, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback } from './ui/avatar';

type ConversationNode = {
    id: string;
    question: string; // The text for the button
    answer?: React.ReactNode; // The bot's response when this node is chosen
    followUp?: ConversationNode[]; // Next set of options
}

const baseKnowledgeTree: ConversationNode[] = [
    {
        id: 'what-is-s3c',
        question: "What is S3 Commander?",
        answer: "S3 Commander is a secure portal for managing access to AWS S3 buckets. It replaces the need to share long-lived credentials by allowing users to request temporary, time-limited access which administrators can approve or deny.",
    },
];

const userKnowledgeTree: ConversationNode[] = [
    {
        id: 'user-main',
        question: "How do I use this application?",
        answer: "I can help with that. What would you like to know?",
        followUp: [
            {
                id: 'how-to-request',
                question: 'How do I request access to a bucket?',
                answer: 'On the main dashboard, find the bucket you need. If you have "Read-Only" access, click the "Request Write" button and fill out the form with your reason and the duration you need.',
            },
            {
                id: 'check-status',
                question: 'How do I check my request status?',
                answer: 'Click on "My Activity" in the sidebar. The "Request History" tab lists all your pending, approved, and denied requests with their current status. You can click on any request to see its full details.',
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
        ]
    },
     ...baseKnowledgeTree,
];

const adminKnowledgeTree: ConversationNode[] = [
    {
        id: 'admin-main',
        question: "How do I manage the system?",
        answer: "As an admin, you have several tools available on the Admin Dashboard. What would you like to do?",
        followUp: [
            {
                id: 'approve-deny',
                question: 'Approve or deny requests?',
                answer: 'Navigate to the "Admin Dashboard". The "Pending Requests" tab lists all active requests. Use the "Approve" or "Deny" buttons. A reason is required for your decision.',
            },
            {
                id: 'grant-permanent',
                question: 'Grant permanent permissions?',
                answer: 'Go to "User Management" on the Admin Dashboard. Click on a user to open their details, then click "Edit Permanent Permissions" at the bottom of the dialog. This lets you assign bucket-specific write access and a global delete permission.',
            },
            {
                id: 'view-logs',
                question: 'View the audit history?',
                answer: "The \"Access Logs\" tab on the \"Admin Dashboard\" provides a complete audit trail. You can add filters for Event Type, User, and Date Range to narrow down the results. There is also a search bar to quickly find specific log entries.",
            },
            {
                id: 'change-role',
                question: 'Change a user\'s role?',
                answer: 'From the "User Management" tab, click on a user to open their details. If you are the system Owner, you will see options at the bottom of the dialog to promote a USER to ADMIN or demote an ADMIN to USER.',
            },
        ]
    },
    ...baseKnowledgeTree,
];

const TypingIndicator = () => (
    <div className="flex items-center space-x-1 p-3">
      <span className="h-2 w-2 bg-muted-foreground rounded-full animate-pulse [animation-delay:-0.3s]" />
      <span className="h-2 w-2 bg-muted-foreground rounded-full animate-pulse [animation-delay:-0.15s]" />
      <span className="h-2 w-2 bg-muted-foreground rounded-full animate-pulse" />
    </div>
);

type ConversationMessage = {
    id: number;
    type: 'bot' | 'user';
    content: React.ReactNode;
}

export function HelpWidget() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = React.useState(false);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  const isAdmin = session?.user?.role === 'admin' || session?.user?.role === 'owner';
  const knowledgeTree = isAdmin ? adminKnowledgeTree : userKnowledgeTree;
  
  const [conversation, setConversation] = React.useState<ConversationMessage[]>([]);
  const [currentNodes, setCurrentNodes] = React.useState<ConversationNode[]>(knowledgeTree);
  const [isBotTyping, setIsBotTyping] = React.useState(false);
  
  const createInitialConversation = React.useCallback(() => {
    setConversation([{ id: 1, type: 'bot', content: "Hello! I'm the S3 Commander assistant. How can I help you today?" }]);
    setCurrentNodes(knowledgeTree);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.role]);

  React.useEffect(() => {
    createInitialConversation();
  }, [createInitialConversation]);

  const scrollToBottom = () => {
    setTimeout(() => {
        if (scrollAreaRef.current) {
            const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (viewport) {
                viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
            }
        }
    }, 100);
  }

  React.useEffect(scrollToBottom, [conversation, isBotTyping]);
  
  function handleQuestionSelect(node: ConversationNode) {
    // Add user question to conversation
    setConversation(prev => [...prev, { id: Date.now(), type: 'user', content: node.question }]);
    
    setIsBotTyping(true);

    setTimeout(() => {
      setIsBotTyping(false);
      // Add bot answer if it exists
      if (node.answer) {
        setConversation(prev => [...prev, { id: Date.now() + 1, type: 'bot', content: node.answer }]);
      }
      // Set the next set of questions
      setCurrentNodes(node.followUp || []);
    }, 800);
  }

  const isSubMenu = currentNodes !== knowledgeTree;
  
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
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={createInitialConversation}>
                    <RotateCw className="h-4 w-4" />
                </Button>
            </div>

            <ScrollArea className="flex-1" ref={scrollAreaRef}>
                <div className="p-4 space-y-4">
                    {conversation.map(msg => (
                        <div key={msg.id} className={cn("flex items-start gap-3 w-full", msg.type === 'user' && 'justify-end')}>
                           {msg.type === 'bot' && (
                                <Avatar className="h-8 w-8 bg-muted">
                                    <AvatarFallback><Bot className="h-5 w-5" /></AvatarFallback>
                                </Avatar>
                           )}
                           <div className={cn(
                               "p-3 rounded-lg max-w-[85%]",
                               msg.type === 'bot' && 'bg-muted text-muted-foreground',
                               msg.type === 'user' && 'bg-primary text-primary-foreground',
                           )}>
                               <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                                {msg.content}
                               </div>
                           </div>
                           {msg.type === 'user' && (
                                <Avatar className="h-8 w-8 bg-accent">
                                    <AvatarFallback><UserIcon className="h-5 w-5" /></AvatarFallback>
                                </Avatar>
                           )}
                        </div>
                    ))}
                    {isBotTyping && (
                         <div className="flex items-start gap-3 w-full">
                            <Avatar className="h-8 w-8 bg-muted">
                                <AvatarFallback><Bot className="h-5 w-5" /></AvatarFallback>
                            </Avatar>
                            <div className="p-3 rounded-lg bg-muted">
                               <TypingIndicator />
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>
            
            {!isBotTyping && (currentNodes.length > 0 || isSubMenu) && (
                <div className="p-4 border-t bg-background/80 backdrop-blur-sm">
                    <div className="flex flex-col space-y-2 w-full">
                        {currentNodes.map((node) => (
                            <Button
                                key={node.id}
                                variant="outline"
                                className="w-full justify-start h-auto text-left whitespace-normal"
                                onClick={() => handleQuestionSelect(node)}
                            >
                                {node.question}
                            </Button>
                        ))}
                        {isSubMenu && (
                             <Button
                                variant="ghost"
                                className="w-full justify-start h-auto text-left whitespace-normal"
                                onClick={() => setCurrentNodes(knowledgeTree)}
                            >
                                <ArrowLeft className="mr-2 h-4 w-4"/> Back to main menu
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Override prose styles for the chat widget
const proseOverride = `
.prose :where(ul):not(:where([class~="not-prose"] *)) {
    margin-top: 0;
    margin-bottom: 0;
    padding-left: 1.2rem;
}
`;
(function() {
    if (typeof document !== 'undefined') {
        const style = document.createElement('style');
        style.innerHTML = proseOverride;
        document.head.appendChild(style);
    }
})();
