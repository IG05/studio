import { Header } from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-full w-full">
      <Header title="Settings" />
      <div className="p-4 md:p-6 flex-1 overflow-y-auto">
        <Card>
            <CardHeader>
                <CardTitle>Application Settings</CardTitle>
                <CardDescription>This page is no longer used in the application.</CardDescription>
            </CardHeader>
            <CardContent>
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Page Deprecated</AlertTitle>
                    <AlertDescription>
                        The navigation link to this settings page has been removed from the sidebar. You can remove this file (`src/app/settings/page.tsx`) if it's no longer needed.
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
