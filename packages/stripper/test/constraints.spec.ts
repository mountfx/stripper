import { describe, it, expect } from 'vitest';
import { maxSrgbChroma } from '../src/gamut';
import { ladderBoundaryL } from '../src/ladder';
import { wcagRatio } from '../src/wcag';
import { lc } from '../src/apca';
import { converter } from 'culori';
import type { ScaleStepNumber } from '../src/types';

const toRgb = converter('rgb');
const oklchToRgb = (l: number, c: number, h: number) => {
  const rgb = toRgb({ mode: 'oklch', l, c, h });
  return [rgb.r, rgb.g, rgb.b];
};

describe('maxSrgbChroma', () => {
  it('achromatic hue allows no chroma at the L extremes', () => {
    expect(maxSrgbChroma(0, 0)).toBeCloseTo(0, 3);
    expect(maxSrgbChroma(1, 0)).toBeCloseTo(0, 3);
  });

  it('vivid hue at mid lightness has a budget that is exactly displayable', () => {
    const max = maxSrgbChroma(0.55, 145);
    expect(max).toBeGreaterThan(0.1);
    // the boundary itself is displayable, slightly beyond is not
    expect(() => {
      const rgb = oklchToRgb(0.55, max, 145);
      if (rgb.some((v) => v < -1e-4 || v > 1 + 1e-4)) throw new Error('out of gamut');
    }).not.toThrow();
    const rgbBeyond = oklchToRgb(0.55, max + 0.01, 145);
    expect(rgbBeyond.some((v) => v < -1e-3 || v > 1 + 1e-3)).toBe(true);
  });

  it('hue budgets differ — the Stripe "imaginary colors" insight', () => {
    // at L 0.65 blues have more chroma headroom than yellows...
    expect(maxSrgbChroma(0.65, 264)).toBeGreaterThan(maxSrgbChroma(0.65, 105));
    // ...but near-white the reverse: light vivid blue is impossible, light vivid yellow exists
    expect(maxSrgbChroma(0.9, 105)).toBeGreaterThan(maxSrgbChroma(0.9, 264));
    expect(maxSrgbChroma(0.9, 264)).toBeLessThan(0.05);
  });
});

describe('ladderBoundaryL', () => {
  it('WCAG boundary: the color at the returned lightness satisfies the target within tolerance', () => {
    const step = 500 as ScaleStepNumber;
    const { l, reachable } = ladderBoundaryL(292.2, 0.17, step, 'wcag', 0);
    expect(reachable).toBe(true);
    const rgb = oklchToRgb(l, 0.17, 292.2);
    const hexc = '#' + rgb.map((v) => Math.round(Math.min(255, Math.max(0, v * 255))).toString(16).padStart(2, '0')).join('');
    const ratio = wcagRatio(hexc, '#ffffff');
    // boundary = exact target edge (toleranceOverride 0)
    expect(ratio).toBeCloseTo(4.5, 1);
  });

  it('APCA boundary: the color at the returned lightness satisfies the target within tolerance', () => {
    const step = 400 as ScaleStepNumber;
    const { l, reachable } = ladderBoundaryL(292.2, 0.11, step, 'apca', 0);
    expect(reachable).toBe(true);
    const rgb = oklchToRgb(l, 0.11, 292.2);
    const hexc = '#' + rgb.map((v) => Math.round(Math.min(255, Math.max(0, v * 255))).toString(16).padStart(2, '0')).join('');
    const value = lc(hexc, '#000000');
    // boundary = exact target edge (toleranceOverride 0)
    expect(value).toBeCloseTo(-60, 0);
  });

  it('flags unreachable targets at the given chroma (vivid yellow at step 950)', () => {
    // displayable yellow at C 0.30 only exists at high lightness, where the
    // ratio vs white is ~1.2:1 — the 19:1 target has no boundary at this chroma
    const { reachable } = ladderBoundaryL(105, 0.30, 950 as ScaleStepNumber, 'wcag');
    expect(reachable).toBe(false);
  });

  it('none mode: no contract (flagged unreachable sentinel)', () => {
    const result = ladderBoundaryL(292.2, 0.17, 500 as ScaleStepNumber, 'none');
    expect(result.reachable).toBe(false);
  });
});
