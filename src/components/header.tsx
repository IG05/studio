import { ReactNode } from 'react';
import { Separator } from './ui/separator';
import { SidebarTrigger } from './ui/sidebar';
import { ThemeToggle } from './theme-toggle';

interface HeaderProps {
  title: string;
  actions?: ReactNode;
}

export function Header({ title, actions }: HeaderProps) {
  return (
    <header className="sticky top-0 bg-background/95 backdrop-blur z-10">
      <div className="p-4 md:p-6 flex items-center justify-between h-16">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <ThemeToggle />
        </div>
      </div>
      <Separator />
    </header>
  );
}
