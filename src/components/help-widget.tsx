"use client";

import * as React from 'react';
import { useSession } from 'next-auth/react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { HelpCircle, ArrowLeft } from 'lucide-react';

type QnaItem = {
  id: string;
  question: string;
  answer: React.ReactNode;
};

const baseQuestions: QnaItem[] = [
  {
    id: 'what-it-does',
    question: 'What does this application do?',
    answer: 'S3 Commander is a secure portal for managing access to AWS S3 buckets. It replaces the need to share long-lived credentials by allowing users to request temporary, time-limited access. Administrators can approve or deny these requests, manage permanent permissions, and view a full audit trail of all activities.',
  },
];

const userQuestions: QnaItem[] = [
  ...baseQuestions,
  {
    id: 'how-to-request',
    question: 'How do I request temporary access to a bucket?',
    answer: 'On the main "S3 Buckets Dashboard", find the bucket you need. If you have "No Access", click the "Request Access" button and fill out the form with your reason and the duration you need.',
  },
  {
    id: 'check-status',
    question: 'How can I check the status of my requests?',
    answer: 'Click on "My Requests" in the left sidebar menu. This page lists all your pending, approved, and denied requests with their current status.',
  },
  {
    id: 'view-files',
    question: 'How do I view files in a bucket?',
    answer: 'If your access status for a bucket is "Full Access" or "Temporary Access", you can click the "View" button on the dashboard or click the bucket\'s name in the sidebar to browse its contents.',
  },
  {
    id: 'what-access-means',
    question: 'What do the different access statuses mean?',
    answer: (
      <ul className="list-disc space-y-2 pl-4">
        <li><strong>Full Access:</strong> You have permanent permission.</li>
        <li><strong>Temporary Access:</strong> You have been granted access for a limited time. The expiration is shown.</li>
        <li><strong>No Access:</strong> You currently have no permission and must request it.</li>
      </ul>
    ),
  },
  {
    id: 'max-duration',
    question: 'What is the maximum access duration I can request?',
    answer: 'You can request access for a duration between 15 minutes and a maximum of 12 hours (720 minutes). An administrator will review and approve the final duration.',
  },
];

const adminQuestions: QnaItem[] = [
    ...baseQuestions,
  {
    id: 'approve-deny',
    question: 'How do I approve or deny access requests?',
    answer: 'Navigate to the "Admin Dashboard" via the sidebar. The "Pending Requests" tab lists all active requests. Use the green check (✓) to approve or the red X to deny a request. You must provide a reason for your decision.',
  },
  {
    id: 'grant-permanent',
    question: 'How do I grant a user permanent bucket access?',
    answer: 'On the "Admin Dashboard", go to the "User Management" tab. Click the action menu (⋮) for the desired user and select "Assign Buckets" to manage their permanent permissions.',
  },
  {
    id: 'view-history',
    question: 'How can I view a history of all administrative actions?',
    answer: 'The "Access Logs" tab on the "Admin Dashboard" provides a complete audit trail of all access decisions, role changes, and permission modifications made by all administrators.',
  },
  {
    id: 'change-role',
    question: 'How do I change a user\'s role?',
    answer: 'From the "User Management" tab, click the action menu (⋮) for a user to change their role. Please note: Only users with the "OWNER" role have the ability to promote users to Admin or change an existing Admin back to a User.',
  },
  {
    id: 'request-details',
    question: 'Where can I see the full details of a request?',
    answer: 'In the "Access Logs" tab, find the relevant \'ACCESS_REQUEST_DECISION\' event. Click the action menu (⋮) and select "View Details" to see a full summary, including the original user\'s justification and the deciding admin\'s reason.',
  },
];


export function HelpWidget() {
  const { data: session } = useSession();
  const [selectedQuestionId, setSelectedQuestionId] = React.useState<string | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) {
      // Reset to question list when popover is closed
      const timer = setTimeout(() => setSelectedQuestionId(null), 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!session) return null;

  const isAdmin = session.user?.role === 'admin' || session.user?.role === 'owner';
  const questions = isAdmin ? adminQuestions : userQuestions;
  const selectedQna = questions.find(q => q.id === selectedQuestionId);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="default"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg"
          size="icon"
        >
          <HelpCircle className="h-7 w-7" />
          <span className="sr-only">Help</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 sm:w-96" side="top" align="end">
        <div className="space-y-4">
          <h4 className="font-medium leading-none text-center">
            {selectedQna ? selectedQna.question : "Help & Support"}
          </h4>
          <div className="text-sm text-muted-foreground">
            {selectedQna ? (
              <div className="space-y-4">
                <div>{selectedQna.answer}</div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedQuestionId(null)}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to questions
                </Button>
              </div>
            ) : (
              <div className="flex flex-col space-y-2">
                {questions.map((qna) => (
                  <Button
                    key={qna.id}
                    variant="outline"
                    className="justify-start text-left h-auto py-2"
                    onClick={() => setSelectedQuestionId(qna.id)}
                  >
                    {qna.question}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
