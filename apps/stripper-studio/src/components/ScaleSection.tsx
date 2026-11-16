import { memo } from 'react';
import { criticalPairWarnings, familyById, type Scale } from 'stripper';
import type { ScaleKey } from '@/context/StudioState';
import { ScaleStrip } from './ScaleStrip';
import { ContrastMatrix } from './ContrastMatrix';
import { CurveChart } from './CurveChart';

export interface ScaleSectionProps {
  role: ScaleKey;
  title: string;
  scale: Scale | null;
  error: string | null;
  preset: string | null;
}

/**
 * Memoized: during urgent passes (e.g. slider drags) the deferred scale prop
 * keeps its identity, so the entire main column skips re-rendering and the
 * expensive charts/matrix recompute only in the deferred (transition) pass.
 */
export const ScaleSection = memo(function ScaleSection({ role, title, scale, error, preset }: ScaleSectionProps) {
  const warnings = scale ? [...scale.warnings, ...criticalPairWarnings(scale)] : [];
  const presetFamily = preset ? familyById(preset) : undefined;

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <div className="flex items-center gap-2">
          {presetFamily && (
            <span className="border border-border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap">
              {presetFamily.name} preset (exact)
            </span>
          )}
          <span className="font-mono text-[11px] text-muted-foreground">
            {scale?.closestFamily ? 'family: ' + scale.closestFamily + ' · ' : ''}
            anchor: {scale?.anchorStep}
          </span>
        </div>
      </div>
      {error && (
        <p className="border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
          {error}
        </p>
      )}
      <ScaleStrip scale={scale} scaleKey={role} />
      {warnings.map((w) => (
        <p key={w} className="font-mono text-[11px] text-muted-foreground">
          ⚠ {w}
        </p>
      ))}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <CurveChart scale={scale} metric="l" scaleKey={role} />
        <CurveChart scale={scale} metric="c" scaleKey={role} />
        <CurveChart scale={scale} metric="h" scaleKey={role} />
      </div>
      <ContrastMatrix scale={scale} />
    </section>
  );
});
