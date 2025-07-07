"use client";

import { usePathname } from 'next/navigation';
import { Toaster } from '@/components/ui/toaster';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  return (
    <>
      {isLoginPage ? (
        <>
          {children}
          <Toaster />
        </>
      ) : (
        <SidebarProvider>
          <div className="flex h-full w-full">
            <AppSidebar />
            <SidebarInset className="overflow-y-auto">{children}</SidebarInset>
          </div>
          <Toaster />
        </SidebarProvider>
      )}
    </>
  );
}
