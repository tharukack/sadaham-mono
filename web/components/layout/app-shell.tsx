import * as React from 'react';

import { cn } from '../../lib/utils';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

type AppShellProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
};

export function AppShell({ title, children, className }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-muted/40">
      <div className="hidden w-64 border-r bg-background lg:flex">
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col">
        <Topbar title={title} />
        <main className={cn('flex-1 p-6', className)}>
          <div className="mx-auto w-full max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
