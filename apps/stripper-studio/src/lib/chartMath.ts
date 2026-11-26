/**
 * Pure chart geometry: monotone spline fitting and constraint-region contour
 * tracing. The displayability predicate the contours consume comes from the
 * engine (inSrgb / maxSrgbChroma). No framework coupling — fully
 * unit-testable.
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

// ---- Stripe-style iso-contour extraction (constraint regions, all metrics) --------------

export type Pt = [number, number];

/**
 * Closed iso-contours of a boolean grid (`true` = inside the region),
 * extracted with marching squares at the 0.5 level and smoothed with
 * Chaikin corner cutting. Returns one point loop per boundary — islands and
 * holes alike; the caller renders all loops as subpaths of a single path
 * with the evenodd fill rule (Stripe-style constraint regions).
 *
 * `xs`/`ys` give the pixel position of each grid node. A false ring is
 * padded around the grid so regions touching the plot border close along
 * it; contour points falling outside the node bounding box are clamped
 * back onto it.
 *
 * `refine` (optional) evaluates the continuous inside/outside predicate at
 * any pixel position. When given, boundary crossings are located by
 * bisection along their grid edge instead of snapping to the edge midpoint,
 * so contours follow the true boundary at subpixel precision instead of the
 * grid lattice.
 */
export function traceIsoContours(
cells: boolean[][],
xs: number[],
ys: number[],
smoothIterations = 2,
refine?: (x: number, y: number) => boolean,
): Pt[][] {
const rows = cells.length;
const cols = rows > 0 ? cells[0]!.length : 0;
if (rows === 0 || cols === 0) return [];

// padded value grid (false ring) with node positions one spacing beyond the
// outermost real nodes, mirroring the node spacing at each edge
const R = rows + 2;
const C = cols + 2;
const val: boolean[][] = Array.from({ length: R }, () => new Array<boolean>(C).fill(false));
for (let r = 0; r < rows; r++) {
 for (let c = 0; c < cols; c++) val[r + 1]![c + 1] = cells[r]![c]!;
}
const nx: number[] = [cols > 1 ? 2 * xs[0]! - xs[1]! : xs[0]! - 1, ...xs, cols > 1 ? 2 * xs[cols - 1]! - xs[cols - 2]! : xs[cols - 1]! + 1];
const ny: number[] = [rows > 1 ? 2 * ys[0]! - ys[1]! : ys[0]! - 1, ...ys, rows > 1 ? 2 * ys[rows - 1]! - ys[rows - 2]! : ys[rows - 1]! + 1];

const xmin = xs[0]!, xmax = xs[cols - 1]!;
const ymin = Math.min(...ys), ymax = Math.max(...ys);
const clamp = (p: Pt): Pt => [Math.min(xmax, Math.max(xmin, p[0]!)), Math.min(ymax, Math.max(ymin, p[1]!))];

/**
 * Crossing of the region boundary on the grid edge between nodes p (value
 * vp) and q (value vq): the edge midpoint, or — with `refine` — the exact
 * predicate flip located by bisection. Falls back to the midpoint when the
 * predicate does not bracket a flip along the edge (e.g. the padded ring's
 * by-fiat false value).
 */
const edgePoint = (p: Pt, vp: boolean, q: Pt, vq: boolean): Pt => {
 const mid: Pt = [(p[0]! + q[0]!) / 2, (p[1]! + q[1]!) / 2];
 if (!refine || vp === vq) return mid;
 const rp = refine(p[0]!, p[1]!);
 const rq = refine(q[0]!, q[1]!);
 if (rp === rq) return mid;
 let lo = rp ? p : q;
 let hi = rp ? q : p;
 for (let k = 0; k < 8; k++) {
  const m: Pt = [(lo[0]! + hi[0]!) / 2, (lo[1]! + hi[1]!) / 2];
  if (refine(m[0]!, m[1]!)) lo = m;
  else hi = m;
 }
 return [(lo[0]! + hi[0]!) / 2, (lo[1]! + hi[1]!) / 2];
};

// crossing point per grid edge — shared by the two cells on either side,
// so each boundary edge is refined exactly once
const hPts: Pt[][] = [];
for (let r = 0; r < R; r++) {
 const row: Pt[] = [];
 for (let c = 0; c + 1 < C; c++) {
  row.push(edgePoint([nx[c]!, ny[r]!], val[r]![c]!, [nx[c + 1]!, ny[r]!], val[r]![c + 1]!));
 }
 hPts.push(row);
}
const vPts: Pt[][] = [];
for (let r = 0; r + 1 < R; r++) {
 const row: Pt[] = [];
 for (let c = 0; c < C; c++) {
  row.push(edgePoint([nx[c]!, ny[r]!], val[r]![c]!, [nx[c]!, ny[r + 1]!], val[r + 1]![c]!));
 }
 vPts.push(row);
}

// marching squares: one segment per boundary cell (saddles resolve to the
// 4-connected interpretation — diagonal corners do not connect)
const raw: Array<[Pt, Pt]> = [];
for (let r = 0; r + 1 < R; r++) {
 for (let c = 0; c + 1 < C; c++) {
  const tl = val[r]![c]!, tr = val[r]![c + 1]!, br = val[r + 1]![c + 1]!, bl = val[r + 1]![c]!;
  const idx = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
  if (idx === 0 || idx === 15) continue;
  const top: Pt = hPts[r]![c]!;
  const bottom: Pt = hPts[r + 1]![c]!;
  const left: Pt = vPts[r]![c]!;
  const right: Pt = vPts[r]![c + 1]!;
  switch (idx) {
   case 1: raw.push([left, bottom]); break;
   case 2: raw.push([bottom, right]); break;
   case 3: case 12: raw.push([left, right]); break;
   case 4: raw.push([top, right]); break;
   case 5: raw.push([left, bottom]); raw.push([top, right]); break;
   case 6: case 9: raw.push([top, bottom]); break;
   case 7: case 8: raw.push([top, left]); break;
   case 10: raw.push([top, left]); raw.push([bottom, right]); break;
   case 11: raw.push([top, right]); break;
   case 13: raw.push([bottom, right]); break;
   case 14: raw.push([left, bottom]); break;
  }
 }
}

// clamp to the plot rect and drop segments that collapsed onto the border
const key = (p: Pt) => `${p[0]!.toFixed(6)},${p[1]!.toFixed(6)}`;
const segs: Array<[Pt, Pt]> = [];
for (const [a, b] of raw) {
 const ca = clamp(a), cb = clamp(b);
 if (key(ca) !== key(cb)) segs.push([ca, cb]);
}

// stitch segments into closed loops (every crossing point is shared by
// exactly two segments; border clamping can locally raise that, resolved
// by greedy continuation)
const byPoint = new Map<string, number[]>();
segs.forEach((s, i) => {
 for (const p of s) {
  const k = key(p);
  const list = byPoint.get(k);
  if (list) list.push(i);
  else byPoint.set(k, [i]);
 }
});
const used = new Array<boolean>(segs.length).fill(false);
const loops: Pt[][] = [];
for (let i = 0; i < segs.length; i++) {
 if (used[i]!) continue;
 used[i] = true;
 const loop: Pt[] = [segs[i]![0]!, segs[i]![1]!];
 let closed = false;
 for (let guard = segs.length; guard > 0 && !closed; guard--) {
  const cur = loop[loop.length - 1]!;
  const candidates = (byPoint.get(key(cur)) ?? []).filter((j) => !used[j]!);
  if (candidates.length === 0) break;
  const j = candidates[0]!;
  used[j] = true;
  const [a, b] = segs[j]!;
  const next = key(a) === key(cur) ? b : a;
  if (key(next) === key(loop[0]!)) closed = true;
  else loop.push(next);
 }
 if (closed && loop.length >= 3) loops.push(loop);
}

// Chaikin corner cutting: each pass replaces every corner by the 1/4 and
// 3/4 points of its two edges
let out = loops;
for (let it = 0; it < smoothIterations; it++) {
 out = out.map((loop) => {
  const next: Pt[] = [];
  const n = loop.length;
  for (let i = 0; i < n; i++) {
   const p = loop[i]!, q = loop[(i + 1) % n]!;
   next.push([0.75 * p[0]! + 0.25 * q[0]!, 0.75 * p[1]! + 0.25 * q[1]!]);
   next.push([0.25 * p[0]! + 0.75 * q[0]!, 0.25 * p[1]! + 0.75 * q[1]!]);
  }
  return next;
 });
}
return out;
}
