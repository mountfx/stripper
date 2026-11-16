/**
 * Pure chart geometry math: monotone splines, gamut-aware lightness/hue
 * intervals, and region tracing. No framework coupling — fully unit-testable.
 */
import { inGamut } from 'culori';

/** cells for the per-sample axis scans */
const AXIS_CELLS = 32;

const inSrgb = inGamut('rgb');

export function monotoneSpline(values: number[]): (t: number) => number {
const n = values.length;
if (n === 0) return () => 0;
if (n === 1) return () => values[0]!;
const d: number[] = [];
for (let i = 0; i < n - 1; i++) d.push(values[i + 1]! - values[i]!);
const m: number[] = new Array(n).fill(0);
m[0] = d[0]!;
m[n - 1] = d[n - 2]!;
for (let i = 1; i < n - 1; i++) {
 m[i] = d[i - 1]! * d[i]! <= 0 ? 0 : (d[i - 1]! + d[i]!) / 2;
}
for (let i = 0; i < n - 1; i++) {
 if (d[i] === 0) {
  m[i] = 0;
  m[i + 1] = 0;
  continue;
 }
 const a = m[i]! / d[i]!;
 const b = m[i + 1]! / d[i]!;
 const s = a * a + b * b;
 if (s > 9) {
  const tau = 3 / Math.sqrt(s);
  m[i] = tau * a * d[i]!;
  m[i + 1] = tau * b * d[i]!;
 }
}
return (t: number) => {
 const x = Math.min(Math.max(t, 0), 1) * (n - 1);
 const i = Math.min(Math.floor(x), n - 2);
 const u = x - i;
 const h00 = 2 * u * u * u - 3 * u * u + 1;
 const h10 = u * u * u - 2 * u * u + u;
 const h01 = -2 * u * u * u + 3 * u * u;
 const h11 = u * u * u - u * u;
 return h00 * values[i]! + h10 * m[i]! + h01 * values[i + 1]! + h11 * m[i + 1]!;
};
}


export function wrapHue(h: number): number {
return ((h % 360) + 360) % 360;
}

// ---- everything derived from scale + measured width -------------------------------------

export function traceExtents(
xs: number[],
lo: Array<number | null>,
hi: Array<number | null>,
minThickness: number,
y: (v: number) => number,
): string[] {
const polys: string[] = [];
let run: Array<{ x: number; lo: number; hi: number }> = [];
const flush = () => {
 if (run.length < 2) {
  run = [];
  return;
 }
 const upper = run.map((p) => `${p.x.toFixed(2)},${y(p.hi).toFixed(2)}`);
 const lower = run
  .slice()
  .reverse()
  .map((p) => `${p.x.toFixed(2)},${y(p.lo).toFixed(2)}`);
 polys.push(`M${upper.join(' L')} L${lower.join(' L')} Z`);
 run = [];
};
for (let i = 0; i < xs.length; i++) {
 const l = lo[i] ?? null;
 const h = hi[i] ?? null;
 if (l === null || h === null || h - l < minThickness) {
  flush();
  continue;
 }
 if (run.length > 0) {
  const last = run[run.length - 1]!;
  // continuity: the new extent must overlap the previous one
  if (Math.min(last.hi, h) < Math.max(last.lo, l) - minThickness) flush();
 }
 run.push({ x: xs[i]!, lo: l, hi: h });
}
flush();
return polys;
}

/** Displayable lightness interval at a given chroma/hue (null when none exists). */

export function displayableLRange(c: number, h: number): { lo: number; hi: number } | null {
const K = AXIS_CELLS;
let first = -1;
let last = -1;
for (let k = 0; k <= K; k++) {
 const l = k / K;
 if (inSrgb({ mode: 'oklch', l, c, h })) {
  if (first === -1) first = l;
  last = l;
 }
}
if (first === -1) return null;
const cell = 1 / K;
let lo = first;
let hi = last;
if (first > 0) {
 let a = first - cell;
 let b = first;
 for (let k = 0; k < 8; k++) {
  const mid = (a + b) / 2;
  if (inSrgb({ mode: 'oklch', l: mid, c, h })) b = mid;
  else a = mid;
 }
 lo = b;
}
if (last < 1) {
 let a = last;
 let b = last + cell;
 for (let k = 0; k < 8; k++) {
  const mid = (a + b) / 2;
  if (inSrgb({ mode: 'oklch', l: mid, c, h })) a = mid;
  else b = mid;
 }
 hi = a;
}
return { lo, hi };
}

/** Hue interval around the curve hue that is displayable at the given lightness/chroma.
 *  The band is the displayable arc containing the curve hue; when the curve hue itself
 *  is out of gamut it is the nearest displayable arc in the window, bridged to the
 *  curve hue (pinched to the curve hue when no hue in the window is displayable) so
 *  the constraint regions never cross the line. */

export function displayableHueRange(l: number, c: number, curveHue: number, dmin: number, dmax: number): { lo: number; hi: number } {
const displayable = (h: number) => inSrgb({ mode: 'oklch', l, c, h: wrapHue(h) });
const cell = (dmax - dmin) / AXIS_CELLS;

// bisect a run edge between a displayable and a non-displayable bracket
const refine = (good: number, bad: number): number => {
let a = good;
let b = bad;
for (let k = 0; k < 10; k++) {
const mid = (a + b) / 2;
if (displayable(mid)) a = mid;
else b = mid;
}
return a;
};

if (displayable(curveHue)) {
let h = curveHue;
while (h < dmax && displayable(Math.min(h + cell, dmax))) h = Math.min(h + cell, dmax);
const hi = h >= dmax ? dmax : refine(h, Math.min(h + cell, dmax));
h = curveHue;
while (h > dmin && displayable(Math.max(h - cell, dmin))) h = Math.max(h - cell, dmin);
const lo = h <= dmin ? dmin : refine(h, Math.max(h - cell, dmin));
return { lo, hi };
}

// curve hue out of gamut: fine-scan the window for displayable runs and take the
// one nearest the curve hue (narrow runs are invisible at the cell resolution)
const step = cell / 8;
const runs: Array<{ lo: number; hi: number }> = [];
let start: number | null = null;
let last = dmin;
const n = Math.ceil((dmax - dmin) / step);
for (let k = 0; k <= n; k++) {
const h = Math.min(dmin + k * step, dmax);
if (displayable(h)) {
if (start === null) start = h;
last = h;
} else if (start !== null) {
runs.push({ lo: start, hi: last });
start = null;
}
}
if (start !== null) runs.push({ lo: start, hi: last });
if (runs.length === 0) return { lo: curveHue, hi: curveHue };

const dist = (r: { lo: number; hi: number }) => (curveHue < r.lo ? r.lo - curveHue : curveHue > r.hi ? curveHue - r.hi : 0);
let pick = runs[0]!;
for (const r of runs) {
const d = dist(r) - dist(pick);
if (d < 0 || (d === 0 && r.hi - r.lo > pick.hi - pick.lo)) pick = r;
}

const runLo = pick.lo <= dmin ? dmin : refine(pick.lo, pick.lo - step);
const runHi = pick.hi >= dmax ? dmax : refine(pick.hi, pick.hi + step);
return { lo: Math.min(curveHue, runLo), hi: Math.max(curveHue, runHi) };
}
