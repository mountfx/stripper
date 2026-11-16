import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { CheckIcon } from './icons';

const ROOT =
  'flex size-4 shrink-0 items-center justify-center rounded-none border p-0 border-input bg-card select-none data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-disabled:border-muted-foreground data-disabled:text-muted-foreground disabled:border-muted-foreground disabled:text-muted-foreground';

export function Checkbox({ className, ...props }: ComponentProps<typeof BaseCheckbox.Root>) {
  return (
    <BaseCheckbox.Root className={cn(ROOT, className)} {...props}>
      <BaseCheckbox.Indicator className="flex data-unchecked:hidden">
        <CheckIcon />
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );
}
