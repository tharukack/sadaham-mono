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
    <div className="relative flex min-h-screen bg-gradient-to-b from-sky-50/60 via-white to-amber-50/60">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_-10%_-10%,rgba(125,211,252,0.16),transparent),radial-gradient(800px_400px_at_110%_-20%,rgba(253,230,138,0.16),transparent)]" />
      <div className="hidden w-64 border-r bg-background lg:flex">
        <Sidebar />
      </div>
      <div className="relative flex min-w-0 flex-1 flex-col">
        <Topbar title={title} />
        <main className={cn('flex-1 min-w-0 p-4 sm:p-6', className)}>
          <div className="mx-auto w-full max-w-[1400px] space-y-4 sm:space-y-6 2xl:max-w-[1600px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
