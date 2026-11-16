import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const TAB =
  'flex h-[calc(2rem+1px)] items-center justify-center bg-transparent px-2 py-0 text-sm font-normal leading-5 break-keep whitespace-nowrap text-muted-foreground outline-none select-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-1 focus-visible:outline-ring data-active:text-foreground';

const LIST = 'relative z-1 -mb-px flex gap-1';

const INDICATOR =
  'absolute top-0 left-0 -z-1 h-full w-(--active-tab-width) translate-x-(--active-tab-left) border-x border-t border-border bg-card transition-[translate,width] duration-150 ease-in-out';

export function TabsRoot({ className, ...props }: ComponentProps<typeof BaseTabs.Root>) {
  return <BaseTabs.Root className={className} {...props} />;
}

export function TabsList({ className, ...props }: ComponentProps<typeof BaseTabs.List>) {
  return <BaseTabs.List className={cn(LIST, className)} {...props} />;
}

export function TabsTab({ className, ...props }: ComponentProps<typeof BaseTabs.Tab>) {
  return <BaseTabs.Tab className={cn(TAB, className)} {...props} />;
}

export function TabsIndicator({ className, ...props }: ComponentProps<typeof BaseTabs.Indicator>) {
  return <BaseTabs.Indicator className={cn(INDICATOR, className)} {...props} />;
}

export function TabsPanel({ className, ...props }: ComponentProps<typeof BaseTabs.Panel>) {
  return <BaseTabs.Panel className={cn('outline-none', className)} {...props} />;
}
