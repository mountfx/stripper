import { describe, it, expect } from 'vitest';
import { wcagRatio, ratioOnBlack, ratioOnWhite, wcagLevel, WCAG_LEVELS } from '../src/wcag';

describe('WCAG 2.2 contrast', () => {
  it('black vs white is exactly 21:1', () => {
    expect(wcagRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(ratioOnBlack('#ffffff')).toBeCloseTo(21, 5);
    expect(ratioOnWhite('#000000')).toBeCloseTo(21, 5);
  });

  it('matches the known golden value #767676 vs white ≈ 4.54:1', () => {
    expect(wcagRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 1);
    expect(ratioOnWhite('#767676')).toBeCloseTo(4.54, 1);
  });

  it('is symmetric: ratio(a, b) === ratio(b, a)', () => {
    const pairs: Array<[string, string]> = [
      ['#a286fd', '#ffffff'],
      ['#798680', '#000000'],
      ['#22c55e', '#0a1e12'],
    ];
    for (const [a, b] of pairs) {
      expect(wcagRatio(a, b)).toBeCloseTo(wcagRatio(b, a), 9);
    }
  });

  it('white-on-black relation: ratioOnWhite(x) === 21 / ratioOnBlack(x)', () => {
    for (const hex of ['#a286fd', '#798680', '#7a30e8', '#baadff']) {
      expect(ratioOnWhite(hex)).toBeCloseTo(21 / ratioOnBlack(hex), 9);
    }
  });

  it('classifies levels: 7 AAA, 4.5 AA, 3 large, below 3 null', () => {
    expect(wcagLevel(8)).toBe(7);
    expect(wcagLevel(5)).toBe(4.5);
    expect(wcagLevel(3.2)).toBe(3);
    expect(wcagLevel(2.9)).toBeNull();
    expect(WCAG_LEVELS.map((l) => l.min)).toEqual([7, 4.5, 3]);
  });

  it('level thresholds are strict minimums — no rounding of the ratio', () => {
    expect(wcagLevel(4.499)).toBe(3);
    expect(wcagLevel(4.5)).toBe(4.5);
    expect(wcagLevel(4.51)).toBe(4.5);
    expect(wcagLevel(6.999)).toBe(4.5);
    expect(wcagLevel(7)).toBe(7);
  });
});
