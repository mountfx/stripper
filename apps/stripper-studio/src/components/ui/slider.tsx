import { Slider as BaseSlider } from '@base-ui/react/slider';
import type { ComponentProps } from 'react';

export interface SliderProps extends ComponentProps<typeof BaseSlider.Root> {
  thumbAriaLabel?: string;
}

export function Slider({ className, thumbAriaLabel = 'value', ...props }: SliderProps) {
  return (
    <BaseSlider.Root className={className} {...props}>
      <BaseSlider.Control className="flex w-full touch-none items-center py-3 select-none">
        <BaseSlider.Track className="h-0.5 w-full bg-muted select-none">
          <BaseSlider.Indicator className="bg-primary select-none" />
          <BaseSlider.Thumb
            aria-label={thumbAriaLabel}
            className="size-4 border border-input bg-card select-none has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
          />
        </BaseSlider.Track>
      </BaseSlider.Control>
    </BaseSlider.Root>
  );
}
