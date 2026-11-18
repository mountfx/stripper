import { describe, it, expect } from 'vitest';
import { monotoneSpline, traceExtents } from '../src/lib/chartMath';

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

describe('traceExtents', () => {
  const y = (v: number) => 100 - v * 100; // 0..1 -> 100..0

  it('emits one closed polygon per contiguous run of overlapping extents', () => {
    const polys = traceExtents(
      [0, 10, 20, 30, 40],
      [0, 0.2, null, 0.1, 0.1],
      [1, 0.8, null, 0.5, 0.5],
      0.01,
      y,
    );
    expect(polys).toHaveLength(2);
    // upper edge runs hi left->right, lower edge lo right->left, closed
    for (const poly of polys) {
      expect(poly.startsWith('M')).toBe(true);
      expect(poly.endsWith('Z')).toBe(true);
    }
  });

  it('drops runs thinner than the minimum thickness and single-sample runs', () => {
    const polys = traceExtents(
      [0, 10, 20],
      [0.5, 0.5, 0.5],
      [0.5005, 0.502, 0.9],
      0.01, // min thickness in value units
      y,
    );
    // first two samples: hi - lo = 0.0005 / 0.002 < minThickness; last is single-sample
    expect(polys).toHaveLength(0);
  });
});
