import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import type { ReactElement, ReactNode } from 'react';
import { cn } from '@/lib/utils';

const POPUP =
  'relative flex flex-col border border-border bg-popover px-2 py-1 text-sm text-popover-foreground origin-[var(--transform-origin)] shadow-[0.25rem_0.25rem_0] shadow-black/12 transition-[transform,opacity] duration-100 ease-out data-ending-style:opacity-0 data-ending-style:[transform:scale(0.98)] data-instant:transition-none data-starting-style:opacity-0 data-starting-style:[transform:scale(0.98)]';

export function TooltipProvider({
  children,
  delay = 150,
  closeDelay = 0,
}: {
  children: ReactNode;
  delay?: number;
  closeDelay?: number;
}) {
  return (
    <BaseTooltip.Provider delay={delay} closeDelay={closeDelay}>
      {children}
    </BaseTooltip.Provider>
  );
}

interface TooltipProps {
  /** the trigger element; its props are merged with the tooltip trigger's */
  children: ReactElement;
  content: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  sideOffset?: number;
  className?: string;
}

export function Tooltip({ children, content, side = 'bottom', sideOffset = 6, className }: TooltipProps) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} sideOffset={sideOffset} className="z-50 outline-hidden">
          <BaseTooltip.Popup className={cn(POPUP, className)}>{content}</BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
