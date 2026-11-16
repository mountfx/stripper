import { Button as BaseButton } from '@base-ui/react/button';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'solid' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md';

const baseClasses =
  'flex items-center justify-center gap-2 rounded-none border text-sm leading-none whitespace-nowrap font-normal select-none focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-ring data-disabled:border-muted-foreground data-disabled:text-muted-foreground disabled:border-muted-foreground disabled:text-muted-foreground';

const variantClasses: Record<ButtonVariant, string> = {
  outline:
    'border-border bg-card text-foreground hover:not-data-disabled:bg-accent active:not-data-disabled:bg-accent data-pressed:bg-accent',
  solid:
    'border-border bg-primary text-primary-foreground hover:not-data-disabled:bg-foreground/80 active:not-data-disabled:bg-foreground/70 data-pressed:bg-foreground/80',
  ghost:
    'border-transparent bg-transparent text-foreground hover:not-data-disabled:bg-accent active:not-data-disabled:bg-accent data-pressed:bg-accent',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-7 px-2 text-xs',
  md: 'h-8 px-3',
};

export interface ButtonProps extends ComponentProps<typeof BaseButton> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = 'outline', size = 'md', className, ...props }: ButtonProps) {
  return (
    <BaseButton className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)} {...props} />
  );
}
