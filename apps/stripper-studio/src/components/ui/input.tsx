import { Input as BaseInput } from '@base-ui/react/input';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const classes =
  'h-8 w-full border border-input bg-card px-2 text-sm font-normal text-foreground placeholder:text-muted-foreground focus:outline-2 focus:-outline-offset-1 focus:outline-ring data-disabled:border-muted-foreground data-disabled:text-muted-foreground disabled:border-muted-foreground disabled:text-muted-foreground';

export function Input({ className, ...props }: ComponentProps<typeof BaseInput>) {
  return <BaseInput className={cn(classes, className)} {...props} />;
}
