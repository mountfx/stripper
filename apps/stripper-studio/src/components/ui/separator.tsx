import { Separator as BaseSeparator } from '@base-ui/react/separator';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Separator({ className, ...props }: ComponentProps<typeof BaseSeparator>) {
  return <BaseSeparator orientation="horizontal" className={cn('h-px w-full bg-muted', className)} {...props} />;
}
