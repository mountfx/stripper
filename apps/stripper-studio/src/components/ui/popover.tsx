import { Popover as BasePopover } from '@base-ui/react/popover';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Popover(props: ComponentProps<typeof BasePopover.Root>) {
  return <BasePopover.Root data-slot="popover" {...props} />;
}

export function PopoverTrigger({ className, ...props }: ComponentProps<typeof BasePopover.Trigger>) {
  return <BasePopover.Trigger data-slot="popover-trigger" className={className} {...props} />;
}

type PopoverContentProps = ComponentProps<typeof BasePopover.Popup> & {
  align?: ComponentProps<typeof BasePopover.Positioner>['align'];
  sideOffset?: number;
};

export function PopoverContent({ className, align = 'start', sideOffset = 6, children, ...props }: PopoverContentProps) {
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner align={align} sideOffset={sideOffset} className="z-50">
        <BasePopover.Popup
          data-slot="popover-content"
          className={cn(
            'w-72 origin-(--transform-origin) border border-border bg-popover text-popover-foreground outline-none transition-[scale,opacity] duration-100 ease-out data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0',
            className,
          )}
          {...props}
        >
          {children}
        </BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  );
}
