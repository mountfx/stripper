<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import {
 maxSrgbChroma,
 type Scale,
 type ScaleStepNumber,
} from 'stripper';
import { clearFocused, isFocused, setFocused } from '../composables/useStudioState';
import {
  monotoneSpline,
  wrapHue,
  traceExtents,
  displayableLRange,
  displayableHueRange,
} from '../lib/chartMath';

const props = defineProps<{
 scale: Scale | null;
 metric: 'l' | 'c' | 'h';
 scaleKey: 'primary' | 'neutral';
}>();

/** Chart height in real pixels; width is measured so the SVG renders 1:1. */
const H = 180;
const PAD = 10;
const SAMPLES = 36; // x-samples for the smooth curve and region tracing

const wrap = ref<HTMLElement | null>(null);
const width = ref(620);
let observer: ResizeObserver | undefined;

onMounted(() => {
 if (typeof ResizeObserver === 'undefined' || !wrap.value) return;
 observer = new ResizeObserver((entries) => {
  const w = entries[0]?.contentRect.width ?? 0;
  if (w > 0) width.value = w;
 });
 observer.observe(wrap.value);
});
onBeforeUnmount(() => observer?.disconnect());

const LABEL: Record<string, string> = {
 l: 'Lightness (L)',
 c: 'Chroma (C)',
 h: 'Hue (H)',
};

// ---- monotone spline (Fritsch–Carlson) through the step values -------------------------
const chart = computed(() => {
 const scale = props.scale;
 const W = width.value;
 if (!scale || W <= 0) return null;

 const steps = scale.steps;
 const n = steps.length;
 const colWidth = (W - 2 * PAD) / (n - 1);
 const xStep = (j: number) => PAD + j * colWidth;

 // shortest-arc unwrapped hue per step
 let prev = steps[0]!.oklch.h;
 const hue = steps.map((s) => {
  let h = s.oklch.h;
  while (h - prev > 180) h -= 360;
  while (prev - h > 180) h += 360;
  prev = h;
  return h;
 });

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
  props.metric === 'l' ? v.L : props.metric === 'c' ? v.C : v.H;

 // chroma ceiling per sample (C chart): the displayable chroma budget
 const ceilings = samples.map((s) => maxSrgbChroma(s.L, wrapHue(s.H)));

 // dynamic y-domain: zoomed to the curve, padded (Stripe-style);
 // the C chart domain includes the ceiling so it stays visible with headroom
 const vals = samples.map(metricValue);
 let dmin = Math.min(...vals);
 let dmax = Math.max(...vals);
 const span = Math.max(dmax - dmin, 1e-6);
 const pad = props.metric === 'h' ? Math.max(24, span * 0.3) : Math.max(0.07, span * 0.35);
 dmin -= pad;
 dmax += pad;
 if (props.metric === 'l') {
  dmin = Math.max(0, dmin);
  dmax = Math.min(1, dmax);
  if (dmax - dmin < 0.05) dmax = Math.min(1, dmin + 0.05);
 }
 if (props.metric === 'c') {
  dmin = 0;
  dmax = Math.max(dmax, ...ceilings) * 1.15;
 }
 if (props.metric === 'h') {
  dmin = Math.floor(dmin);
  dmax = Math.ceil(dmax);
 }

  const plotTop = 0;
  const plotBottom = H;
 const y = (v: number) =>
  plotBottom - ((Math.min(Math.max(v, dmin), dmax) - dmin) / (dmax - dmin)) * (plotBottom - plotTop);

 const minThickness = ((dmax - dmin) / (plotBottom - plotTop)) * 1.5; // ~1.5px in value units

 return { W, steps, n, colWidth, xStep, samples, hueUnwrapped: hue, ceilings, metricValue, dmin, dmax, plotTop, plotBottom, y, minThickness };
});

// ---- curve + dots ------------------------------------------------------------------------
const curveSegments = computed(() => {
 const c = chart.value;
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
  const gradId = `seg-${props.scaleKey}-${props.metric}-${j}`;
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
});

const dots = computed(() => {
 const c = chart.value;
 if (!c) return [];
 return c.steps.map((s, j) => ({
  x: c.xStep(j),
  y: c.y(c.metricValue({ L: s.oklch.l, C: s.oklch.c, H: c.hueUnwrapped[j]! })),
  hex: s.hex,
  step: s.number as ScaleStepNumber,
  approximated: s.approximated ?? false,
 }));
});

// ---- region tracing: ONE closed smooth polygon per constraint region ----------------------

/**
 * Trace per-sample vertical extents [lo, hi] into closed polygons.
 * Contiguous samples with overlapping extents form ONE polygon:
 * upper edge left→right along `hi`, lower edge right→left along `lo`.
 * Null extents split the trace (region absent at that position).
 */
const regionTraces = computed<string[]>(() => {
  const c = chart.value;
  if (!c) return [];
  const xs = c.samples.map((s) => s.t * c.W);
  const traces: string[] = [];

 if (props.metric === 'l') {
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
   traces.push(
    ...traceExtents(
     xs,
     lo.map(() => c.dmin),
     lo,
     c.minThickness,
     c.y,
    ),
   );
   traces.push(
    ...traceExtents(
     xs,
     hi,
     hi.map(() => c.dmax),
     c.minThickness,
     c.y,
    ),
   );
 }

 if (props.metric === 'c') {
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

  if (props.metric === 'h') {
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
});

// ---- hover
const hovered = ref<number | null>(null);
const tooltip = computed(() => {
 const i = hovered.value;
 const c = chart.value;
 if (i === null || !c) return null;
 const step = c.steps[i]!;
 const x = Math.min(Math.max(c.xStep(i), 72), c.W - 72);
 const value = c.metricValue({ L: step.oklch.l, C: step.oklch.c, H: step.oklch.h });
 return { x, y: c.y(value) - 10, text: `${step.number} · ${formatValue(value)}` };
});

function formatValue(v: number): string {
 if (props.metric === 'h') return `${Math.round(wrapHue(v))}°`;
 if (props.metric === 'c') return v.toFixed(3);
 return v.toFixed(2);
}

function isEnlarged(step: ScaleStepNumber, index: number): boolean {
  return hovered.value === index || isFocused(props.scaleKey, step);
}

function onDotEnter(index: number, step: ScaleStepNumber) {
  hovered.value = index;
  setFocused(props.scaleKey, step);
}

function onDotLeave() {
 hovered.value = null;
 clearFocused(props.scaleKey);
}

</script>

<template>
 <div>
   <div class="pb-1 pt-2">
    <div class="text-xs font-medium text-muted-foreground">{{ LABEL[metric] }}</div>
   </div>
  <div ref="wrap" class="relative rounded-md shadow-[inset_0_0_0_1px_var(--color-border)]">
   <svg v-if="chart" :viewBox="`0 0 ${width} ${H}`" :style="{ height: `${H}px` }" class="block w-full">
    <defs>
      <pattern
       :id="`hatch-gray-${scaleKey}-${metric}`"
       width="7" height="7" patternUnits="userSpaceOnUse"
       patternTransform="rotate(-45)"
      >
       <line x1="0" y1="3.5" x2="7" y2="3.5" style="stroke: #d4d4d8; stroke-width: 1px" />
      </pattern>
     <linearGradient
      v-for="seg in curveSegments"
      :key="seg.gradId"
      :id="seg.gradId"
      gradientUnits="userSpaceOnUse"
      :x1="seg.x1" :y1="0" :x2="seg.x2" :y2="0"
     >
      <stop offset="0%" :stop-color="seg.from" />
      <stop offset="100%" :stop-color="seg.to" />
     </linearGradient>
    </defs>

    <!-- plot background -->
    <rect
     x="0" y="0" :width="width" :height="H"
     class="fill-muted/40"
    />

    <!-- hatched constraint regions: one smooth shape per region -->
    <path
     v-for="(trace, ti) in regionTraces"
     :key="'t' + ti"
     :d="trace"
     :fill="`url(#hatch-gray-${scaleKey}-${metric})`"
     style="stroke: #d4d4d8; stroke-width: 1px"
     class="chart-region-gray"
    />

    <!-- smooth per-step-colored curve -->
    <polyline
     v-for="seg in curveSegments"
     :key="seg.gradId"
     :points="seg.d"
     fill="none"
     :stroke="seg.stroke"
     stroke-width="2"
     stroke-linecap="round"
     stroke-linejoin="round"
    />

    <!-- dots -->
    <g
     v-for="(dot, di) in dots"
     :key="dot.step"
     class="cursor-default"
     @mouseenter="onDotEnter(di, dot.step)"
     @mouseleave="onDotLeave()"
    >
     <circle :cx="dot.x" :cy="dot.y" r="10" fill="transparent" />
     <circle
      :cx="dot.x"
      :cy="dot.y"
      :r="isEnlarged(dot.step, di) ? 5 : 3.5"
      class="fill-background"
      :stroke="dot.hex"
      stroke-width="1.5"
      :stroke-dasharray="dot.approximated ? '2 2' : undefined"
     >
      <title>{{ dot.step }} — {{ dot.hex }}</title>
     </circle>
    </g>

   </svg>
   <!-- HTML tooltip: crisp text -->
   <div
    v-if="tooltip"
    class="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-full"
    :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }"
   >
    <div class="whitespace-nowrap border border-border bg-popover px-2 py-1 font-mono text-xs leading-none text-popover-foreground shadow-md">
     {{ tooltip.text }}
    </div>
   </div>
  </div>
 </div>
</template>
