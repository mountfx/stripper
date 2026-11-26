import { describe, it, expect } from 'vitest';
// apca-w3 is a dev-only oracle: it is never imported by engine source code.
import { APCAcontrast, sRGBtoY } from 'apca-w3';
import { lc, lcBlackOn, lcWhiteOn } from '../src/apca';
import { apcaLevel } from '../src/contrast';

const oracle = (txt: string, bg: string) => {
  const toY = (hex: string) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return sRGBtoY([(n >> 16) & 255, (n >> 8) & 255, n & 255]);
  };
  return APCAcontrast(toY(txt), toY(bg));
};

const GOLDEN_PAIRS: Array<[string, string]> = [
  ['#000000', '#ffffff'],
  ['#ffffff', '#000000'],
  ['#000000', '#767676'],
  ['#ffffff', '#767676'],
  ['#798680', '#ffffff'],
  ['#798680', '#000000'],
  ['#a286fd', '#ffffff'],
  ['#a286fd', '#000000'],
  ['#895af6', '#ffffff'],
  ['#7a30e8', '#ffffff'],
  ['#baadff', '#000000'],
  ['#40205a', '#f5f7ff'],
  ['#0a1e12', '#f1f3f3'],
  ['#222f28', '#e6eae9'],
  ['#ff0000', '#00ff00'],
  ['#123456', '#654321'],
  ['#fca5a5', '#450a0a'],
];

describe('APCA 0.0.98G-4g implementation', () => {
  it('matches the canonical apca-w3 oracle on a golden pair set', () => {
    for (const [txt, bg] of GOLDEN_PAIRS) {
      const mine = lc(txt, bg);
      const theirs = oracle(txt, bg);
      expect(Math.abs(mine - theirs), `${txt} on ${bg}`).toBeLessThan(0.01);
    }
  });

  it('uses the canonical polarity: dark on light is positive, light on dark is negative', () => {
    expect(lcBlackOn('#ffffff')).toBeGreaterThan(0);
    expect(lcWhiteOn('#000000')).toBeLessThan(0);
    expect(lcBlackOn('#ffffff')).toBeCloseTo(106.04, 1);
    expect(lcWhiteOn('#000000')).toBeCloseTo(-107.88, 1);
  });

  it('clamps low-contrast results to 0', () => {
    expect(lc('#767676', '#777777')).toBe(0);
    expect(lc('#ffffff', '#fefefe')).toBe(0);
  });

  it('is asymmetric by design (APCA directionality)', () => {
    // APCA uses different exponents for BoW vs WoB; the same pair of colors
    // measured in both directions produces different magnitudes.
    const a = lc('#a286fd', '#5b258e');
    const b = lc('#5b258e', '#a286fd');
    expect(a).toBeLessThan(0);
    expect(b).toBeGreaterThan(0);
    expect(Math.abs(a)).not.toBeCloseTo(Math.abs(b), 1);
  });

  it('level thresholds are strict minimums — no rounding of Lc', () => {
    // the Readability Criterion levels are minimums on the actual Lc value;
    // a 59.999 pair meets Lc 45, not 60 — display code must not round up
    expect(apcaLevel(59.999)).toBe(45);
    expect(apcaLevel(60)).toBe(60);
    expect(apcaLevel(60.001)).toBe(60);
    expect(apcaLevel(-59.999)).toBe(45);
    expect(apcaLevel(-60)).toBe(60);
    expect(apcaLevel(59.5)).toBe(45);
  });
});
