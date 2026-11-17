import { Menu as BaseMenu } from '@base-ui/react/menu';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { CheckIcon } from './icons';

export function DropdownMenu(props: ComponentProps<typeof BaseMenu.Root>) {
  return <BaseMenu.Root data-slot="dropdown-menu" {...props} />;
}

export function DropdownMenuTrigger({ className, ...props }: ComponentProps<typeof BaseMenu.Trigger>) {
  return <BaseMenu.Trigger data-slot="dropdown-menu-trigger" className={className} {...props} />;
}

type DropdownMenuContentProps = ComponentProps<typeof BaseMenu.Popup> & {
  align?: ComponentProps<typeof BaseMenu.Positioner>['align'];
  sideOffset?: number;
};

export function DropdownMenuContent({ className, align = 'start', sideOffset = 6, children, ...props }: DropdownMenuContentProps) {
  return (
    <BaseMenu.Portal>
      <BaseMenu.Positioner align={align} sideOffset={sideOffset} className="z-50">
        <BaseMenu.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            'min-w-32 origin-(--transform-origin) border border-border bg-popover p-1 text-popover-foreground shadow-[0.25rem_0.25rem_0] shadow-black/12 outline-none transition-[scale,opacity] duration-100 ease-out data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0',
            className,
          )}
          {...props}
        >
          {children}
        </BaseMenu.Popup>
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  );
}

export function DropdownMenuRadioGroup({ className, ...props }: ComponentProps<typeof BaseMenu.RadioGroup>) {
  return <BaseMenu.RadioGroup data-slot="dropdown-menu-radio-group" className={className} {...props} />;
}

export function DropdownMenuRadioItem({ className, children, ...props }: ComponentProps<typeof BaseMenu.RadioItem>) {
  return (
    <BaseMenu.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        'grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 px-2 py-1.5 text-sm outline-hidden select-none data-highlighted:bg-primary data-highlighted:text-primary-foreground [&_svg]:size-3.5',
        className,
      )}
      {...props}
    >
      <BaseMenu.RadioItemIndicator className="col-start-1">
        <CheckIcon />
      </BaseMenu.RadioItemIndicator>
      <span className="col-start-2 flex items-center gap-2">{children}</span>
    </BaseMenu.RadioItem>
  );
}
