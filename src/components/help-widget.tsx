
"use client";

import * as React from 'react';
import { useSession } from 'next-auth/react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bot, User as UserIcon, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback } from './ui/avatar';

type QnaItem = {
  id: string;
  question: string;
  answer: React.ReactNode;
};

type ConversationMessage = {
    id: number;
    type: 'bot' | 'user' | 'options';
    content: React.ReactNode;
}

const baseQuestions: QnaItem[] = [
  {
    id: 'what-it-does',
    question: 'What is S3 Commander?',
    answer: 'S3 Commander is a secure portal for managing access to AWS S3 buckets. It replaces the need to share long-lived credentials by allowing users to request temporary, time-limited access which administrators can approve or deny.',
  },
];

const userQuestions: QnaItem[] = [
  ...baseQuestions,
  {
    id: 'how-to-request',
    question: 'How do I request access to a bucket?',
    answer: 'On the main dashboard, find the bucket you need. If you have "No Access", click the "Request Access" button and fill out the form with your reason and the duration you need.',
  },
  {
    id: 'check-status',
    question: 'How do I check my request status?',
    answer: 'Click on "My Requests" in the sidebar. This page lists all your pending, approved, and denied requests with their current status. You can click on any request to see its full details.',
  },
  {
    id: 'view-files',
    question: 'How do I view files in a bucket?',
    answer: 'If your access status is "Full Access" or "Temporary Access", click the "View" button on the dashboard or click the bucket\'s name in the sidebar to browse its contents.',
  },
  {
    id: 'what-access-means',
    question: 'What do the access statuses mean?',
    answer: (
      <ul className="space-y-3">
        <li className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5 h-5 w-5 rounded-full bg-green-500/20 items-center justify-center flex"><div className="h-2 w-2 rounded-full bg-green-500"/></div>
            <div><strong>Full Access:</strong> You have permanent permission to this bucket.</div>
        </li>
        <li className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5 h-5 w-5 rounded-full bg-orange-500/20 items-center justify-center flex"><div className="h-2 w-2 rounded-full bg-orange-500"/></div>
            <div><strong>Temporary Access:</strong> Your access is approved for a limited time.</div>
        </li>
        <li className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5 h-5 w-5 rounded-full bg-red-500/20 items-center justify-center flex"><div className="h-2 w-2 rounded-full bg-red-500"/></div>
            <div><strong>No Access:</strong> You have no permissions. You must request access.</div>
        </li>
        <li className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5 h-5 w-5 rounded-full bg-purple-500/20 items-center justify-center flex"><div className="h-2 w-2 rounded-full bg-purple-500"/></div>
            <div><strong>Revoked:</strong> An administrator ended your temporary access early.</div>
        </li>
      </ul>
    ),
  },
];

const adminQuestions: QnaItem[] = [
    ...baseQuestions,
  {
    id: 'admin-workflow',
    question: 'What is the main admin workflow?',
    answer: 'Go to the "Admin Dashboard". In "Pending Requests", approve or deny access. In "Active Permissions", you can revoke access. In "User Management", you can assign permanent permissions and manage roles. All actions are recorded in the "Access Logs" tab.',
  },
  {
    id: 'approve-deny',
    question: 'How do I approve or deny requests?',
    answer: 'Navigate to the "Admin Dashboard". The "Pending Requests" tab lists all active requests. Use the green check (✓) to approve or the red X to deny a request. A reason is required for your decision.',
  },
  {
    id: 'grant-permanent',
    question: 'How do I grant permanent access?',
    answer: 'On the "Admin Dashboard", go to the "User Management" tab. Click the action menu (⋮) for a user and select "Assign Buckets".',
  },
  {
    id: 'view-user-permissions',
    question: 'How do I see all of a user\'s permissions?',
    answer: 'In "User Management", simply click on a user\'s name. A dialog will appear showing all their permanent and active temporary permissions in one place.',
  },
  {
    id: 'change-role',
    question: 'How do I change a user\'s role?',
    answer: 'From the "User Management" tab, click the action menu (⋮) for a user to change their role. Note: Only the "OWNER" can promote users to "ADMIN".',
  },
  {
    id: 'view-logs',
    question: 'Where can I see the audit history?',
    answer: 'The "Access Logs" tab on the "Admin Dashboard" provides a complete, filterable audit trail of all access decisions, role changes, and permission modifications.',
  }
];

const TypingIndicator = () => (
    <div className="flex items-center space-x-1 p-3">
      <span className="h-2 w-2 bg-muted-foreground rounded-full animate-pulse [animation-delay:-0.3s]" />
      <span className="h-2 w-2 bg-muted-foreground rounded-full animate-pulse [animation-delay:-0.15s]" />
      <span className="h-2 w-2 bg-muted-foreground rounded-full animate-pulse" />
    </div>
);

export function HelpWidget() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = React.useState(false);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  const isAdmin = session?.user?.role === 'admin' || session?.user?.role === 'owner';
  const questions = isAdmin ? adminQuestions : userQuestions;
  
  const createInitialConversation = React.useCallback((): ConversationMessage[] => [
    { id: 1, type: 'bot', content: "Hello! I'm the S3 Commander assistant. How can I help you today?" },
    { id: 2, type: 'options', content: <QuestionOptions onQuestionSelect={handleQuestionSelect} questions={questions} /> },
  ], [questions]);

  const [conversation, setConversation] = React.useState<ConversationMessage[]>(createInitialConversation);
  const [isBotTyping, setIsBotTyping] = React.useState(false);

  // This effect ensures that if the user's role changes (e.g., during a session update),
  // the conversation is reset with the correct set of questions.
  React.useEffect(() => {
    handleRestart();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.role]);


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
  
  function handleQuestionSelect(question: QnaItem) {
    // Remove old options
    setConversation(prev => prev.filter(p => p.type !== 'options'));
    
    // Add user question
    setConversation(prev => [...prev, { id: Date.now(), type: 'user', content: question.question }]);
    
    setIsBotTyping(true);

    setTimeout(() => {
      setIsBotTyping(false);
      // Add bot answer
      setConversation(prev => [...prev, { id: Date.now() + 1, type: 'bot', content: question.answer }]);
      // Add new options
      setConversation(prev => [...prev, { id: Date.now() + 2, type: 'options', content: <QuestionOptions onQuestionSelect={handleQuestionSelect} questions={questions} /> }]);
    }, 800);
  }

  const handleRestart = React.useCallback(() => {
    setConversation(createInitialConversation());
  }, [createInitialConversation]);
  
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
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRestart}>
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
                               msg.type === 'options' && 'bg-transparent p-0 w-full'
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
        </div>
      </PopoverContent>
    </Popover>
  );
}


function QuestionOptions({ questions, onQuestionSelect }: { questions: QnaItem[], onQuestionSelect: (q: QnaItem) => void }) {
    return (
        <div className="flex flex-col space-y-2 w-full">
            {questions.map((q) => (
                <Button
                    key={q.id}
                    variant="outline"
                    className="w-full justify-start h-auto text-left whitespace-normal"
                    onClick={() => onQuestionSelect(q)}
                >
                    {q.question}
                </Button>
            ))}
        </div>
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
