/**
 * Pure chart geometry: monotone spline fitting and constraint-region tracing.
 * The gamut-displayability intervals it consumes come from the engine
 * (displayableLightnessRange / displayableHueRange / maxSrgbChroma).
 * No framework coupling — fully unit-testable.
 */

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
