import type { Scale } from 'stripper';
import { useClipboard } from '@/hooks/useClipboard';
import { useFocus, type ScaleKey } from '@/context/StudioState';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ScaleStripProps {
  scale: Scale | null;
  scaleKey: ScaleKey;
}

export function ScaleStrip({ scale, scaleKey }: ScaleStripProps) {
  const { focused, setFocused, clearFocused } = useFocus();
  const { copyText, lastCopied } = useClipboard();

  if (!scale) return null;

  return (
    <div className="flex h-24 overflow-hidden border border-border">
      {scale.steps.map((step) => {
        const dark = step.oklch.l < 0.62;
        const focusedStep = focused?.key === scaleKey && focused.step === step.number;
        const anchored = scale.anchors?.some((a) => a.step === step.number) ?? false;
        const textColor = dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)';
        return (
          <Tooltip
            key={step.number}
            className="font-mono"
            content={
              <span>
                {step.number} — {step.hex} ·{' '}
                {`oklch(${(step.oklch.l * 100).toFixed(1)}% ${step.oklch.c.toFixed(3)} ${step.oklch.h.toFixed(1)})`}
              </span>
            }
          >
            <div
              className={cn(
                'group relative flex flex-1 cursor-pointer flex-col justify-between p-2 transition-[flex]',
                focusedStep ? 'flex-[1.4]' : 'hover:flex-[1.4]',
              )}
              style={{ backgroundColor: step.hex }}
              onClick={() => copyText(step.hex)}
              onMouseEnter={() => setFocused(scaleKey, step.number)}
              onMouseLeave={() => clearFocused(scaleKey)}
            >
              <span className="font-mono text-[11px] font-medium" style={{ color: textColor }}>
                {step.number}
              </span>
              <span
                className={cn('font-mono text-[10px] leading-tight', focusedStep ? 'block' : 'hidden group-hover:block')}
                style={{ color: textColor }}
              >
                {step.hex}
                {step.approximated ? ' *' : ''}
              </span>
              {lastCopied === step.hex && (
                <span className="absolute inset-x-1 top-1 bg-black/70 px-1 text-center font-mono text-[9px] text-white">
                  copied
                </span>
              )}
              {anchored && (
                <span
                  className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2"
                  style={{ backgroundColor: textColor }}
                  title="brand color anchored here"
                />
              )}
            </div>
          </Tooltip>
        );
      })}
    </div>
  );
}
