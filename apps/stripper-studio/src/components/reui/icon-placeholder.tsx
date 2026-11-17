import type { ComponentProps, ElementType } from 'react';
import { CheckIcon, ChevronDownIcon, CopyIcon, PipetteIcon } from '@/components/ui/icons';

/**
 * Stand-in for reui's create-environment icon placeholder: resolves the icon
 * by its lucide name onto our inline SVG set.
 */
const ICONS: Record<string, ElementType<ComponentProps<'svg'>>> = {
  ChevronDownIcon,
  PipetteIcon,
  CheckIcon,
  CopyIcon,
};

export function IconPlaceholder({
  lucide,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the other libraries' names are accepted and ignored
  tabler: _tabler,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  hugeicons: _hugeicons,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  phosphor: _phosphor,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  remixicon: _remixicon,
  ...props
}: {
  lucide?: string;
  tabler?: string;
  hugeicons?: string;
  phosphor?: string;
  remixicon?: string;
} & ComponentProps<'svg'>) {
  const Icon = (lucide && ICONS[lucide]) || CheckIcon;
  return <Icon {...props} />;
}
