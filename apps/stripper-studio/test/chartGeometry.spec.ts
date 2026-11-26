import { describe, it, expect } from 'vitest';
import { monotoneSpline, traceIsoContours } from '../src/lib/chartMath';

describe('monotoneSpline', () => {
  it('passes through the data points and preserves monotonicity', () => {
    const values = [0.98, 0.92, 0.71, 0.55, 0.44, 0.32, 0.2, 0.14, 0.09, 0.05, 0.02];
    const spline = monotoneSpline(values);
    const n = values.length;
    for (let i = 0; i < n; i++) {
      expect(spline(i / (n - 1))).toBeCloseTo(values[i]!, 6);
    }
    // Fritsch–Carlson: no overshoot between points
    let prev = spline(0);
    for (let k = 1; k <= 100; k++) {
      const v = spline(k / 100);
      expect(v).toBeLessThanOrEqual(prev + 1e-9);
      prev = v;
    }
  });

  it('handles degenerate inputs', () => {
    expect(monotoneSpline([])(0.5)).toBe(0);
    expect(monotoneSpline([0.42])(0.7)).toBe(0.42);
  });
});

describe('traceIsoContours', () => {
  const xs = [0, 10, 20, 30];
  const ys = [0, 10, 20, 30];

  it('returns no loops for an empty grid', () => {
    expect(traceIsoContours([[false, false, false, false], [false, false, false, false]], xs, ys)).toEqual([]);
  });

  it('emits one closed octagon around a floating island (no refine: midpoint fallback)', () => {
    const cells = [
      [false, false, false, false],
      [false, true, true, false],
      [false, true, true, false],
      [false, false, false, false],
    ];
    const loops = traceIsoContours(cells, xs, ys, 0);
    expect(loops).toHaveLength(1);
    const pts = loops[0]!;
    // the contour runs through the midpoints between inside and outside nodes,
    // half a cell spacing beyond the true block on every side
    expect(pts).toHaveLength(8);
    for (const [x, py] of pts) {
      expect(x).toBeGreaterThanOrEqual(5 - 1e-9);
      expect(x).toBeLessThanOrEqual(25 + 1e-9);
      expect(py).toBeGreaterThanOrEqual(5 - 1e-9);
      expect(py).toBeLessThanOrEqual(25 + 1e-9);
    }
  });

  it('refine snaps the island contour onto the true boundary (no lattice staircase)', () => {
    const cells = [
      [false, false, false, false],
      [false, true, true, false],
      [false, true, true, false],
      [false, false, false, false],
    ];
    // analytic predicate behind the grid: the square [10,20]²
    const inside = (x: number, py: number) => x >= 10 && x <= 20 && py >= 10 && py <= 20;
    const loops = traceIsoContours(cells, xs, ys, 0, inside);
    expect(loops).toHaveLength(1);
    const pts = loops[0]!;
    expect(pts).toHaveLength(8);
    for (const [x, py] of pts) {
      // every contour point lies on the true boundary, not the midpoint lattice
      const onBoundary =
        (Math.abs(x - 10) < 0.1 || Math.abs(x - 20) < 0.1) && py >= 10 - 0.1 && py <= 20 + 0.1;
      const onBoundaryY =
        (Math.abs(py - 10) < 0.1 || Math.abs(py - 20) < 0.1) && x >= 10 - 0.1 && x <= 20 + 0.1;
      expect(onBoundary || onBoundaryY).toBe(true);
    }
  });

  it('emits separate loops for an island and a hole (evenodd rendering)', () => {
    // true band around a false center, touching no plot edge
    const cells = [
      [false, false, false, false, false, false],
      [false, true, true, true, true, false],
      [false, true, false, false, true, false],
      [false, true, false, false, true, false],
      [false, true, true, true, true, false],
      [false, false, false, false, false, false],
    ];
    const xs6 = [0, 10, 20, 30, 40, 50];
    const ys6 = [0, 10, 20, 30, 40, 50];
    const inside = (x: number, py: number) =>
      x >= 10 && x <= 40 && py >= 10 && py <= 40 && !(x >= 20 && x <= 30 && py >= 20 && py <= 30);
    const loops = traceIsoContours(cells, xs6, ys6, 0, inside);
    expect(loops).toHaveLength(2);
    // the hole loop sits strictly inside the outer loop
    const outer = loops.find((l) => l.some(([x]) => x <= 10.05))!;
    const inner = loops.find((l) => l.every(([x]) => x >= 19.9))!;
    expect(outer).toBeTruthy();
    expect(inner).toBeTruthy();
  });

  it('closes regions that touch the plot border along the border, at the true boundary', () => {
    const cells = [
      [true, true, true, true],
      [true, true, true, true],
      [false, false, false, false],
      [false, false, false, false],
    ];
    // nodes y=0..10 true, y=20..30 false -> the boundary is exactly y=10
    const inside = (x: number, py: number) => py <= 10;
    const loops = traceIsoContours(cells, xs, ys, 0, inside);
    expect(loops).toHaveLength(1);
    const pts = loops[0]!;
    const allX = pts.map((p) => p[0]!);
    const allY = pts.map((p) => p[1]!);
    // hugs the plot edges left/right/top (ring midpoint clamped) and meets the
    // true displayability boundary at the bottom
    expect(Math.min(...allX)).toBe(0);
    expect(Math.max(...allX)).toBe(30);
    expect(Math.min(...allY)).toBe(0);
    expect(Math.max(...allY)).toBeLessThanOrEqual(10 + 0.1);
    expect(Math.max(...allY)).toBeGreaterThanOrEqual(10 - 0.1);
  });

  it('refine removes the staircase on diagonal boundaries', () => {
    const cells = [
      [true, true, true, false],
      [true, false, false, false],
      [false, false, false, false],
      [false, false, false, false],
    ];
    // axis-aligned midpoint crossings would land off this boundary
    // (e.g. (0,15): 0 + 2*15 = 30 > 25); refined crossings must lie on it
    const inside = (x: number, py: number) => x + 2 * py <= 25;
    const loops = traceIsoContours(cells, xs, ys, 0, inside);
    expect(loops).toHaveLength(1);
    let onLine = 0;
    for (const [x, py] of loops[0]!) {
      // no point may poke past the true boundary (midpoint fallback would)
      expect(x + 2 * py).toBeLessThanOrEqual(25 + 0.1);
      if (Math.abs(x + 2 * py - 25) <= 0.1) onLine++;
    }
    expect(onLine).toBeGreaterThanOrEqual(3);
  });

  it('merges regions through a fully-hatched column (gamut-tip overshoot)', () => {
    // the L-chart null-range scenario: between the two regions no value at
    // all is displayable — the whole column is out of gamut and must hatch
    // full-height, joining the regions instead of tearing them apart
    const cells = [
      [false, false, true, true],
      [false, false, true, true],
      [true, true, true, false],
      [true, true, true, false],
    ];
    const inside = (x: number, py: number) =>
      (x >= 20 && py <= 10) || (x <= 10 && py >= 20) || (x > 15 && x < 25);
    const loops = traceIsoContours(cells, xs, ys, 0, inside);
    expect(loops).toHaveLength(1);
    const allX = loops[0]!.map((p) => p[0]!);
    const allY = loops[0]!.map((p) => p[1]!);
    expect(Math.min(...allX)).toBeLessThanOrEqual(10.1);
    expect(Math.max(...allX)).toBeGreaterThanOrEqual(19.9);
    expect(Math.min(...allY)).toBeLessThanOrEqual(10.1);
    expect(Math.max(...allY)).toBeGreaterThanOrEqual(19.9);
  });

  it('smoothing keeps loops closed and inside the bounding box', () => {
    const cells = [
      [false, false, false, false],
      [false, true, true, false],
      [false, true, true, false],
      [false, false, false, false],
    ];
    const inside = (x: number, py: number) => x >= 10 && x <= 20 && py >= 10 && py <= 20;
    const loops = traceIsoContours(cells, xs, ys, 2, inside);
    expect(loops).toHaveLength(1);
    expect(loops[0]!.length).toBeGreaterThan(8); // corner cutting adds points
    for (const [x, py] of loops[0]!) {
      expect(x).toBeGreaterThan(10 - 0.1);
      expect(x).toBeLessThan(20 + 0.1);
      expect(py).toBeGreaterThan(10 - 0.1);
      expect(py).toBeLessThan(20 + 0.1);
    }
  });
});
