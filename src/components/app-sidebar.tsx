
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { S3BucketIcon } from './icons';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LayoutDashboard, ShieldCheck, LogOut, HardDrive, ChevronRight, History, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
  } from "@/components/ui/collapsible";
import * as React from 'react';
import type { Bucket } from '@/lib/types';
import { Skeleton } from './ui/skeleton';
import { signOut, useSession } from 'next-auth/react';


const menuLinks = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['owner', 'admin', 'user'] },
    { href: '/requests', label: 'My Requests', icon: History, roles: ['user'] },
    { href: '/admin', label: 'Admin', icon: ShieldCheck, roles: ['owner', 'admin'] },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const { data: session } = useSession();

  const [isBucketsOpen, setIsBucketsOpen] = React.useState(true);
  const [buckets, setBuckets] = React.useState<Bucket[]>([]);
  const [isLoadingBuckets, setIsLoadingBuckets] = React.useState(true);

  const currentUser = session?.user;
  const userRole = currentUser?.role || 'user';
  
  const menuItems = menuLinks.filter(link => link.roles.includes(userRole));

  React.useEffect(() => {
    setIsLoadingBuckets(true);
    // This API call implicitly uses the user's authentication
    // context on the server to return only buckets they have access to.
    fetch('/api/buckets?access=full,limited')
      .then(res => {
        if (!res.ok) return [];
        return res.json();
      })
      .then(data => {
        setBuckets(data);
      })
      .catch(console.error)
      .finally(() => setIsLoadingBuckets(false));
  }, []);

  if (!currentUser) {
    return (
      <Sidebar className="border-r" collapsible="icon">
        <SidebarHeader className="flex flex-row items-center justify-between p-4">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-32 group-data-[collapsible=icon]:hidden" />
        </SidebarHeader>
        <SidebarContent className="p-2">
            <Skeleton className="h-40 w-full" />
        </SidebarContent>
        <SidebarFooter className="p-4">
            <Skeleton className="h-10 w-full" />
        </SidebarFooter>
      </Sidebar>
    );
  }

  return (
    <Sidebar className="border-r" collapsible="icon">
      <SidebarHeader className="flex flex-row items-center justify-between p-4">
        <Link href="/" className="flex items-center gap-2">
          <S3BucketIcon className="w-7 h-7 text-primary" />
          <h1 className="text-xl font-bold group-data-[collapsible=icon]:hidden">S3 Commander</h1>
        </Link>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                className="w-full justify-start group-data-[collapsible=icon]:justify-center"
                tooltip={{ children: item.label, side: 'right' }}
              >
                <Link href={item.href}>
                  <item.icon className="group-data-[collapsible=icon]:mr-0" />
                  <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>

        <SidebarSeparator className="my-2" />

        <Collapsible open={isBucketsOpen} onOpenChange={setIsBucketsOpen} className="px-2">
            <CollapsibleTrigger className={cn("flex items-center justify-between w-full p-2 rounded-md hover:bg-sidebar-accent", state === 'collapsed' && 'justify-center')}>
                <div className="flex items-center gap-3">
                    <HardDrive className="w-5 h-5 shrink-0" />
                    <span className="font-semibold group-data-[collapsible=icon]:hidden">Buckets</span>
                </div>
                <ChevronRight className="w-4 h-4 transition-transform group-data-[collapsible=icon]:hidden data-[state=open]:rotate-90" />
            </CollapsibleTrigger>
            <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
                <SidebarMenu className="py-1 pl-7">
                  {isLoadingBuckets ? (
                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-md my-1" />)
                  ) : buckets.length > 0 ? (
                    buckets.map((bucket) => (
                        <SidebarMenuItem key={bucket.name}>
                        <Link href={`/buckets/${bucket.name}`} className={cn(
                            "flex items-center w-full text-sm rounded-md p-2 hover:bg-sidebar-accent gap-2",
                            pathname.startsWith(`/buckets/${bucket.name}`) && "bg-sidebar-accent"
                        )}>
                            {bucket.access === 'limited' && <Clock className="w-4 h-4 text-orange-400 shrink-0" />}
                            <span className="truncate">{bucket.name}</span>
                        </Link>
                        </SidebarMenuItem>
                    ))
                  ) : (
                    <p className="p-2 text-xs text-muted-foreground">No accessible buckets.</p>
                  )}
                </SidebarMenu>
            </CollapsibleContent>
        </Collapsible>

      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={currentUser.image || ''} alt={currentUser.name || ''} />
            <AvatarFallback>{currentUser.name?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden group-data-[collapsible=icon]:hidden">
            <p className="font-semibold truncate">{currentUser.name}</p>
            <p className="text-xs text-muted-foreground truncate">{currentUser.email}</p>
          </div>
          <form action={async () => { await signOut({ redirectTo: '/login' })}}>
            <SidebarMenuButton type="submit" variant="ghost" size="icon" className="h-9 w-9" aria-label="Log out" tooltip={{ children: 'Log out', side: 'right' }}>
                <LogOut className="w-5 h-5" />
            </SidebarMenuButton>
          </form>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
