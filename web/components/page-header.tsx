import * as React from 'react';

import { cn } from '../lib/utils';

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader(props: PageHeaderProps) {
  const { actions, className } = props;
  if (!actions) return null;

  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-2', className)}>
      {actions}
    </div>
  );
}
