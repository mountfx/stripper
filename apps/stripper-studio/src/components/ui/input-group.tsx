import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export function InputGroup({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      role="group"
      data-slot="input-group"
      className={cn(
        'flex h-8 w-full min-w-0 items-center border border-input bg-card text-sm transition-colors outline-none has-[[data-slot=input-group-control]:focus-visible]:outline-2 has-[[data-slot=input-group-control]:focus-visible]:-outline-offset-1 has-[[data-slot=input-group-control]:focus-visible]:outline-ring',
        className,
      )}
      {...props}
    />
  );
}

export function InputGroupInput({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      data-slot="input-group-control"
      className={cn(
        'min-w-0 flex-1 bg-transparent px-2 text-sm font-normal text-foreground outline-none placeholder:text-muted-foreground disabled:text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function InputGroupAddon({
  className,
  align,
  ...props
}: ComponentProps<'div'> & { align?: 'inline-start' | 'inline-end' }) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(
        'flex items-center gap-1 py-1',
        align === 'inline-start' && 'order-first',
        align === 'inline-end' && 'order-last',
        className,
      )}
      {...props}
    />
  );
}

export function InputGroupButton({ className, variant = 'ghost', size = 'xs', ...props }: ComponentProps<typeof Button>) {
  return (
    <Button type="button" data-slot="input-group-button" variant={variant} size={size} className={className} {...props} />
  );
}
