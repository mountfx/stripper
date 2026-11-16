import { Select } from '@base-ui/react/select';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { CaretDownIcon, CaretUpDownIcon, CaretUpIcon, CheckIcon } from './icons';

const TRIGGER =
  'flex h-8 min-w-40 items-center justify-between gap-3 pl-2 pr-1 text-sm leading-none whitespace-nowrap border border-input bg-card text-foreground select-none hover:not-data-disabled:bg-accent active:not-data-disabled:bg-accent data-disabled:border-muted-foreground data-disabled:text-muted-foreground disabled:border-muted-foreground disabled:text-muted-foreground data-pressed:bg-accent font-normal focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-ring';

const POPUP =
  'group min-w-[var(--anchor-width)] origin-[var(--transform-origin)] bg-clip-padding border border-border bg-popover text-popover-foreground outline-hidden shadow-[0.25rem_0.25rem_0] shadow-black/12 transition-[scale,opacity] duration-100 ease-out data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-[side=none]:translate-y-px data-[side=none]:min-w-[calc(var(--anchor-width)+1.75rem)] data-[side=none]:data-ending-style:transition-none data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-[side=none]:data-starting-style:scale-100 data-[side=none]:data-starting-style:opacity-100 data-[side=none]:data-starting-style:transition-none';

const ITEM =
  'grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 py-1.5 pr-4 pl-2.5 text-sm outline-hidden select-none data-highlighted:bg-primary data-highlighted:text-primary-foreground';

const SCROLL_UP =
  'top-0 z-[1] flex h-4 w-full cursor-default items-center justify-center bg-popover text-center text-xs before:absolute data-[side=none]:before:top-[-100%] before:left-0 before:h-full before:w-full before:content-[""]';

const SCROLL_DOWN =
  'bottom-0 z-[1] flex h-4 w-full cursor-default items-center justify-center bg-popover text-center text-xs before:absolute data-[side=none]:before:bottom-[-100%] before:left-0 before:h-full before:w-full before:content-[""]';

export const SelectRoot = Select.Root;
export const SelectValue = Select.Value;

export function SelectTrigger({ className, children, ...props }: ComponentProps<typeof Select.Trigger>) {
  return (
    <Select.Trigger className={cn(TRIGGER, className)} {...props}>
      {children ?? (
        <>
          <Select.Value className="data-placeholder:text-muted-foreground" />
          <Select.Icon>
            <CaretUpDownIcon />
          </Select.Icon>
        </>
      )}
    </Select.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  scrollArrows = false,
}: {
  className?: string;
  children: ReactNode;
  /** render the scroll arrows — enable for long lists (they overlay short ones) */
  scrollArrows?: boolean;
}) {
  return (
    <Select.Portal>
      <Select.Positioner className="outline-hidden select-none z-10" sideOffset={4}>
        <Select.Popup className={cn(POPUP, 'py-1', className)}>
          {scrollArrows && (
            <Select.ScrollUpArrow className={SCROLL_UP}>
              <CaretUpIcon />
            </Select.ScrollUpArrow>
          )}
          <Select.List className="relative scroll-py-6 overflow-y-auto max-h-[var(--available-height)]">
            {children}
          </Select.List>
          {scrollArrows && (
            <Select.ScrollDownArrow className={SCROLL_DOWN}>
              <CaretDownIcon />
            </Select.ScrollDownArrow>
          )}
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  );
}

export function SelectItem({ className, children, ...props }: ComponentProps<typeof Select.Item>) {
  return (
    <Select.Item className={cn(ITEM, className)} {...props}>
      <Select.ItemIndicator className="col-start-1">
        <CheckIcon />
      </Select.ItemIndicator>
      <Select.ItemText className="col-start-2">{children}</Select.ItemText>
    </Select.Item>
  );
}
