import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return <label className={cn('cursor-default text-sm font-bold text-foreground select-none', className)} {...props} />;
}
