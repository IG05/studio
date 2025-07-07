import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { S3BucketIcon } from './icons';
import type { Bucket } from '@/lib/types';
import { Lock, Unlock, Timer, ChevronRight } from 'lucide-react';
import { RequestAccessDialog } from './request-access-dialog';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface BucketCardProps {
  bucket: Bucket;
}

export function BucketCard({ bucket }: BucketCardProps) {
  const getAccessInfo = () => {
    switch (bucket.access) {
      case 'full':
        return {
          icon: <Unlock className="w-4 h-4 text-green-500" />,
          label: 'Full Access',
          variant: 'secondary',
          badgeClass: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
        };
      case 'limited':
        return {
          icon: <Timer className="w-4 h-4 text-orange-500" />,
          label: 'Temporary Access',
          variant: 'secondary',
          badgeClass: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
        };
      case 'none':
      default:
        return {
          icon: <Lock className="w-4 h-4 text-red-500" />,
          label: 'No Access',
          variant: 'outline',
          badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
        };
    }
  };

  const accessInfo = getAccessInfo();
  const isAccessible = bucket.access === 'full' || bucket.access === 'limited';

  const cardContent = (
    <Card className={cn(
      "flex flex-col h-full transition-colors group",
      isAccessible ? "hover:border-primary cursor-pointer" : "cursor-default"
    )}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <S3BucketIcon className="w-10 h-10 text-muted-foreground" />
          <Badge className={accessInfo.badgeClass}>{accessInfo.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <CardTitle className="truncate">{bucket.name}</CardTitle>
        <CardDescription>{bucket.region}</CardDescription>
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        {bucket.access === 'limited' && bucket.tempAccessExpiresAt ? (
          <p className="text-xs text-muted-foreground">
            Expires in {formatDistanceToNow(parseISO(bucket.tempAccessExpiresAt))}
          </p>
        ) : <div />}
        {isAccessible ? (
           <Button variant="ghost" size="icon" className="group-hover:bg-accent">
              <ChevronRight className="w-5 h-5"/>
           </Button>
        ) : (
          <RequestAccessDialog bucket={bucket}>
            <Button variant="default" size="sm">
              Request Access
            </Button>
          </RequestAccessDialog>
        )}
      </CardFooter>
    </Card>
  );

  if (isAccessible) {
    return (
      <Link href={`/buckets/${bucket.name}`} passHref>
        {cardContent}
      </Link>
    );
  }

  return <div>{cardContent}</div>;
}