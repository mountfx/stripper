import { useEffect, useMemo, useRef, useState } from 'react';
import { ladderBoundaryL, maxSrgbChroma, type ContrastMode, type Scale, type ScaleStepNumber } from 'stripper';
import { useFocus, type ScaleKey } from '@/context/StudioState';
import {
  monotoneSpline,
  wrapHue,
  traceExtents,
  displayableLRange,
  displayableHueRange,
} from '@/lib/chartMath';

const LABEL: Record<string, string> = {
  l: 'Lightness (L)',
  c: 'Chroma (C)',
  h: 'Hue (H)',
};

/** Chart height in real pixels; width is measured so the SVG renders 1:1. */
const H = 180;
const PAD = 10;
const SAMPLES = 36; // x-samples for the smooth curve and region tracing

interface CurveChartProps {
  scale: Scale | null;
  metric: 'l' | 'c' | 'h';
  scaleKey: ScaleKey;
  contrastMode: ContrastMode;
}

export function CurveChart({ scale, metric, scaleKey, contrastMode }: CurveChartProps) {
  const { focused, setFocused, clearFocused } = useFocus();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(620);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined' || !wrapRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setWidth(w);
    });
    observer.observe(wrapRef.current);
    return () => observer.disconnect();
  }, []);

  // ---- monotone spline (Fritsch–Carlson) through the step values ---------------------

  const chart = useMemo(() => {
    if (!scale || width <= 0) return null;

    const W = width;
    const steps = scale.steps;
    const n = steps.length;
    const colWidth = (W - 2 * PAD) / (n - 1);
    const xStep = (j: number) => PAD + j * colWidth;

    // shortest-arc unwrapped hue per step (relative to the previous unwrapped value)
    const hue: number[] = [];
    for (let i = 0; i < steps.length; i++) {
      let h = steps[i]!.oklch.h;
      const prevHue = i > 0 ? hue[i - 1]! : h;
      while (h - prevHue > 180) h -= 360;
      while (prevHue - h > 180) h += 360;
      hue.push(h);
    }

    const splineL = monotoneSpline(steps.map((s) => s.oklch.l));
    const splineC = monotoneSpline(steps.map((s) => s.oklch.c));
    const splineH = monotoneSpline(hue);

    const samples = Array.from({ length: SAMPLES }, (_, i) => {
      const t = i / (SAMPLES - 1);
      const stepIdx = Math.min(n - 1, Math.max(0, Math.round(t * (n - 1))));
      return {
        t,
        x: PAD + t * (W - 2 * PAD),
        L: splineL(t),
        C: Math.max(splineC(t), 0),
        H: splineH(t),
        stepIdx,
        step: steps[stepIdx]!.number as ScaleStepNumber,
      };
    });

    const metricValue = (v: { L: number; C: number; H: number }) =>
      metric === 'l' ? v.L : metric === 'c' ? v.C : v.H;

    // chroma ceiling per sample (C chart): the displayable chroma budget
    const ceilings = samples.map((s) => maxSrgbChroma(s.L, wrapHue(s.H)));

    // dynamic y-domain: zoomed to the curve, padded (Stripe-style);
    // the C chart domain includes the ceiling so it stays visible with headroom
    const vals = samples.map(metricValue);
    let dmin = Math.min(...vals);
    let dmax = Math.max(...vals);
    const span = Math.max(dmax - dmin, 1e-6);
    const pad = metric === 'h' ? Math.max(24, span * 0.3) : Math.max(0.07, span * 0.35);
    dmin -= pad;
    dmax += pad;
    if (metric === 'l') {
      dmin = Math.max(0, dmin);
      dmax = Math.min(1, dmax);
      if (dmax - dmin < 0.05) dmax = Math.min(1, dmin + 0.05);
    }
    if (metric === 'c') {
      dmin = 0;
      dmax = Math.max(dmax, ...ceilings) * 1.15;
    }
    if (metric === 'h') {
      dmin = Math.floor(dmin);
      dmax = Math.ceil(dmax);
    }

    const plotTop = 0;
    const plotBottom = H;
    const y = (v: number) =>
      plotBottom - ((Math.min(Math.max(v, dmin), dmax) - dmin) / (dmax - dmin)) * (plotBottom - plotTop);

    const minThickness = ((dmax - dmin) / (plotBottom - plotTop)) * 1.5; // ~1.5px in value units

    return { W, steps, n, colWidth, xStep, samples, hueUnwrapped: hue, ceilings, metricValue, dmin, dmax, y, minThickness };
  }, [scale, width, metric]);

  // ---- curve + dots -------------------------------------------------------------------

  const curveSegments = useMemo(() => {
    const c = chart;
    if (!c) return [];
    // one smooth polyline per step pair, stroked with a per-segment gradient of the step colors (Stripe-style)
    const segs: Array<{ d: string; stroke: string; gradId: string; from: string; to: string; x1: number; x2: number }> = [];
    for (let j = 0; j < c.n - 1; j++) {
      const from = c.steps[j]!.hex;
      const to = c.steps[j + 1]!.hex;
      const pts: string[] = [];
      const sub = 6;
      for (let k = 0; k <= sub; k++) {
        const t = (j + k / sub) / (c.n - 1);
        const s = c.samples[Math.round(t * (SAMPLES - 1))] ?? c.samples[0]!;
        pts.push(`${s.x},${c.y(c.metricValue(s))}`);
      }
      const gradId = `seg-${scaleKey}-${metric}-${j}`;
      segs.push({
        d: pts.join(' '),
        stroke: `url(#${gradId})`,
        gradId,
        from,
        to,
        x1: c.xStep(j),
        x2: c.xStep(j + 1),
      });
    }
    return segs;
  }, [chart, scaleKey, metric]);

  const dots = useMemo(() => {
    const c = chart;
    if (!c) return [];
    return c.steps.map((s, j) => ({
      x: c.xStep(j),
      y: c.y(c.metricValue({ L: s.oklch.l, C: s.oklch.c, H: c.hueUnwrapped[j]! })),
      hex: s.hex,
      step: s.number as ScaleStepNumber,
      approximated: s.approximated ?? false,
    }));
  }, [chart]);

  // ---- contrast ladder boundary (L chart, ladder modes only) ----------------------------
  // The lightness at which each step's ladder target is exactly met for the
  // step's own hue/chroma. With a ladder active, generated steps sit on this
  // line; deviations = unreachable targets (approximated) or kept anchors.

  const ladderSegments = useMemo<string[]>(() => {
    const c = chart;
    if (!c || metric !== 'l' || contrastMode === 'none') return [];
    const segments: string[] = [];
    let run: string[] = [];
    c.steps.forEach((s, j) => {
      const boundary = ladderBoundaryL(s.oklch.h, s.oklch.c, s.number, contrastMode, 0);
      if (!boundary.reachable) {
        if (run.length > 1) segments.push(run.join(' '));
        run = [];
        return;
      }
      run.push(`${c.xStep(j).toFixed(2)},${c.y(boundary.l).toFixed(2)}`);
    });
    if (run.length > 1) segments.push(run.join(' '));
    return segments;
  }, [chart, metric, contrastMode]);

  // ---- region tracing: ONE closed smooth polygon per constraint region ----------------

  const regionTraces = useMemo<string[]>(() => {
    const c = chart;
    if (!c) return [];
    const xs = c.samples.map((s) => s.t * c.W);
    const traces: string[] = [];

    if (metric === 'l') {
      // per sample: displayable range (gray hatch outside of it)
      const lo: Array<number | null> = [];
      const hi: Array<number | null> = [];
      for (const s of c.samples) {
        const range = displayableLRange(s.C, wrapHue(s.H));
        if (!range) {
          lo.push(null);
          hi.push(null);
          continue;
        }
        lo.push(range.lo);
        hi.push(range.hi);
      }
      // gamut regions (gray): below the displayable range and above it
      traces.push(...traceExtents(xs, lo.map(() => c.dmin), lo, c.minThickness, c.y));
      traces.push(...traceExtents(xs, hi, hi.map(() => c.dmax), c.minThickness, c.y));
    }

    if (metric === 'c') {
      // gray above the displayable chroma ceiling
      const lo: Array<number | null> = [];
      const hi: Array<number | null> = [];
      for (let i = 0; i < c.samples.length; i++) {
        const ceiling = Math.min(c.ceilings[i]!, c.dmax);
        lo.push(ceiling);
        hi.push(c.dmax);
      }
      traces.push(...traceExtents(xs, lo, hi, c.minThickness, c.y));
    }

    if (metric === 'h') {
      // gray above and below the displayable hue band anchored at the curve hue;
      // a minimum channel around the line keeps it clear of the hatch even where
      // the true displayable arc pinches to a knife edge near the gamut tip
      const minHalf = (6 / H) * (c.dmax - c.dmin);
      const belowLo: Array<number | null> = [];
      const belowHi: Array<number | null> = [];
      const aboveLo: Array<number | null> = [];
      const aboveHi: Array<number | null> = [];
      for (const s of c.samples) {
        const band = displayableHueRange(s.L, s.C, s.H, c.dmin, c.dmax);
        const lo = Math.min(band.lo, s.H - minHalf);
        const hi = Math.max(band.hi, s.H + minHalf);
        belowLo.push(c.dmin);
        belowHi.push(lo > c.dmin ? lo : null);
        aboveLo.push(hi < c.dmax ? hi : null);
        aboveHi.push(c.dmax);
      }
      traces.push(...traceExtents(xs, belowLo, belowHi, c.minThickness, c.y));
      traces.push(...traceExtents(xs, aboveLo, aboveHi, c.minThickness, c.y));
    }

    return traces;
  }, [chart, metric]);

  // ---- hover --------------------------------------------------------------------------

  const tooltip = useMemo(() => {
    const i = hovered;
    const c = chart;
    if (i === null || !c) return null;
    const step = c.steps[i]!;
    const x = Math.min(Math.max(c.xStep(i), 72), c.W - 72);
    const value = c.metricValue({ L: step.oklch.l, C: step.oklch.c, H: step.oklch.h });
    return { x, y: c.y(value) - 10, text: `${step.number} · ${formatValue(value, metric)}` };
  }, [hovered, chart, metric]);

  function isEnlarged(step: ScaleStepNumber, index: number): boolean {
    return hovered === index || (focused?.key === scaleKey && focused.step === step);
  }

  function onDotEnter(index: number, step: ScaleStepNumber) {
    setHovered(index);
    setFocused(scaleKey, step);
  }

  function onDotLeave() {
    setHovered(null);
    clearFocused(scaleKey);
  }

  return (
    <div>
      <div className="pb-1 pt-2">
        <div className="text-xs font-medium text-muted-foreground">{LABEL[metric]}</div>
      </div>
      <div ref={wrapRef} className="relative outline-1 outline-solid outline-(--chart-stroke) -outline-offset-1">
        {chart && (
          <svg viewBox={`0 0 ${width} ${H}`} style={{ height: `${H}px` }} className="block w-full">
            <defs>
              <pattern
                id={`hatch-gray-${scaleKey}-${metric}`}
                width="7"
                height="7"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(-45)"
              >
                <line x1="0" y1="3.5" x2="7" y2="3.5" style={{ stroke: 'var(--chart-stroke)', strokeWidth: 1 }} />
              </pattern>
              {curveSegments.map((seg) => (
                <linearGradient
                  key={seg.gradId}
                  id={seg.gradId}
                  gradientUnits="userSpaceOnUse"
                  x1={seg.x1}
                  y1={0}
                  x2={seg.x2}
                  y2={0}
                >
                  <stop offset="0%" stopColor={seg.from} />
                  <stop offset="100%" stopColor={seg.to} />
                </linearGradient>
              ))}
            </defs>

            {/* plot background */}
            <rect x="0" y="0" width={width} height={H} className="fill-muted/0" />

            {/* hatched constraint regions: one smooth shape per region */}
            {regionTraces.map((trace, ti) => (
              <path
                key={`t${ti}`}
                d={trace}
                fill={`url(#hatch-gray-${scaleKey}-${metric})`}
                style={{ stroke: 'var(--chart-stroke)', strokeWidth: 1 }}
                className="chart-region-gray"
              />
            ))}

            {/* contrast ladder boundary: dashed, drawn under the curve so it shows only
                where points deviate (unreachable targets, kept anchors) */}
            {ladderSegments.map((points, i) => (
              <polyline
                key={`ladder-${i}`}
                points={points}
                fill="none"
                stroke="var(--color-foreground)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                className="chart-ladder-line"
              />
            ))}

            {/* smooth per-step-colored curve */}
            {curveSegments.map((seg) => (
              <polyline
                key={seg.gradId}
                points={seg.d}
                fill="none"
                stroke={seg.stroke}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {/* dots */}
            {dots.map((dot, di) => (
              <g
                key={dot.step}
                className="cursor-default"
                onMouseEnter={() => onDotEnter(di, dot.step)}
                onMouseLeave={onDotLeave}
              >
                <circle cx={dot.x} cy={dot.y} r="10" fill="transparent" />
                <circle
                  cx={dot.x}
                  cy={dot.y}
                  r={isEnlarged(dot.step, di) ? 5 : 3.5}
                  className="fill-card"
                  stroke={dot.hex}
                  strokeWidth="1.5"
                  strokeDasharray={dot.approximated ? '2 2' : undefined}
                >
                  <title>
                    {dot.step} — {dot.hex}
                  </title>
                </circle>
              </g>
            ))}
          </svg>
        )}
        {/* HTML tooltip: crisp text */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-full"
            style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
          >
            <div className="whitespace-nowrap border border-border bg-popover px-2 py-1 font-mono text-xs leading-none text-popover-foreground">
              {tooltip.text}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatValue(v: number, metric: 'l' | 'c' | 'h'): string {
  if (metric === 'h') return `${Math.round(wrapHue(v))}°`;
  if (metric === 'c') return v.toFixed(3);
  return v.toFixed(2);
}
