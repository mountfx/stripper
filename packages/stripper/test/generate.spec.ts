import { describe, it, expect } from 'vitest';
import { generateScale, defaultConfig } from '../src/generate';
import { resolveLadderAnchorStep } from '../src/anchor-resolution';

import { stepLc } from './helpers';
import { targetFor } from '../src/targets';
import { SCALE_STEPS, type Oklch } from '../src/types';
import { parse, converter } from 'culori';

function engineOklch(hex: string): Oklch {
  const c = toOklch(parse(hex)!);
  return { l: c.l, c: c.c ?? 0, h: c.h ?? 0 };
}

const toOklch = converter('oklch');

describe('defaultConfig', () => {
  it('runs the balanced curve with the APCA contrast ladder by default', () => {
    const config = defaultConfig();
    expect(config.baseMode).toBe('balancedCurve');
    expect(config.contrastMode).toBe('apca');
  });

  it('has no tint by default', () => {
    expect(defaultConfig().hue.tint).toBeUndefined();
  });
});

describe('generateScale — tailwindTransfer + APCA (uicolors parity)', () => {
  const scale = generateScale('#a286fd', { ...defaultConfig(), baseMode: 'tailwindTransfer' });

  it('produces 11 steps with valid hexes', () => {
    expect(scale.steps).toHaveLength(11);
    expect(scale.steps.map((s) => s.number)).toEqual([...SCALE_STEPS]);
    for (const step of scale.steps) {
      expect(step.hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('picks the violet family for a violet input', () => {
    expect(scale.closestFamily).toBe('Violet');
  });

  it('hits the APCA target table within ±2 Lc per step', () => {
    for (const step of scale.steps) {
      const target = targetFor(step.number);
      const achieved = stepLc(step.hex, step.number);
      expect(Math.abs(achieved - target.lc), `step ${step.number}`).toBeLessThanOrEqual(2);
      expect(step.approximated).toBeFalsy();
    }
  });
});

describe('generateScale — tailwindTransfer, no contrast', () => {
  const cfg = { ...defaultConfig(), baseMode: 'tailwindTransfer' as const, contrastMode: 'none' as const };

  it('pins the input exactly at the anchor step', () => {
    const scale = generateScale('#a286fd', cfg);
    const anchor = scale.steps.find((s) => s.number === scale.anchorStep)!;
    expect(anchor.hex).toBe('#a286fd');
  });

  it('keeps hue roughly constant across steps (no drift by default)', () => {
    const scale = generateScale('#a286fd', cfg);
    const hues = scale.steps.map((s) => s.oklch.h);
    const spread = Math.max(...hues) - Math.min(...hues);
    // transfer carries the family's own hue variation (violet is ~flat), so allow small spread
    expect(spread).toBeLessThan(12);
  });
});

describe('generateScale — balancedCurve mode (the default)', () => {
  it('generates a displayable scale from the averaged profile', () => {
    const cfg = { ...defaultConfig(), baseMode: 'balancedCurve' as const, contrastMode: 'none' as const };
    const scale = generateScale('#3b82f6', cfg);
    expect(scale.steps).toHaveLength(11);
    for (const step of scale.steps) {
      expect(step.hex).toMatch(/^#[0-9a-f]{6}$/);
    }
    // monotone lightness from 50 -> 950
    const ls = scale.steps.map((s) => s.oklch.l);
    for (let i = 1; i < ls.length; i++) expect(ls[i]!).toBeLessThan(ls[i - 1]!);
  });
});

describe('generateScale — tinted scales (e.g. neutrals)', () => {
  const muted = { ...defaultConfig(), contrastMode: 'none' as const };

  it('generates a low-chroma tinted scale from a muted input', () => {
    const scale = generateScale('#798680', muted);
    for (const step of scale.steps) {
      expect(step.oklch.c).toBeLessThan(0.06);
    }
  });

  it('hue.tint applies a fixed hue across all steps', () => {
    const tintHue = 120;
    const scale = generateScale('#798680', { ...muted, hue: { tint: tintHue, driftLight: 0, driftDark: 0 } });
    for (const step of scale.steps) {
      expect(Math.abs(step.oklch.h - tintHue)).toBeLessThan(2);
    }
  });

  it('tint with borrowed hue keeps neutral chroma levels', () => {
    const primary = generateScale('#a286fd', { ...defaultConfig(), contrastMode: 'none' as const });
    const primaryHue = primary.steps.find((s) => s.number === primary.anchorStep)!.oklch.h;
    const scale = generateScale('#798680', { ...muted, hue: { tint: primaryHue, driftLight: 0, driftDark: 0 } });
    const mid = scale.steps.find((s) => s.number === 500)!;
    expect(Math.abs(mid.oklch.h - primaryHue)).toBeLessThan(2);
    expect(mid.oklch.c).toBeLessThan(0.06);
  });
});

describe('error and edge-case handling', () => {
  it('throws a descriptive error for an empty anchor list', () => {
    expect(() => generateScale([], defaultConfig())).toThrow('At least one brand color is required');
  });

  it('resolveLadderAnchorStep does not crash in none mode (profile-lightness fallback)', () => {
    const inputOk = engineOklch('#a286fd');
    const step = resolveLadderAnchorStep(inputOk, { ...defaultConfig(), contrastMode: 'none' });
    expect(SCALE_STEPS).toContain(step);
  });
});

describe('generateScale — gamut safety', () => {
  it('keeps every step displayable in sRGB for an extreme input', () => {
    for (const input of ['#ff00ff', '#00ff7f', '#0000ff', '#7fff00']) {
      const cfg = { ...defaultConfig(), baseMode: 'balancedCurve' as const };
      const scale = generateScale(input, cfg);
      for (const step of scale.steps) {
        const back = toOklch(parse(step.hex)!);
        const forward = step.oklch;
        expect(back.l, `input ${input} step ${step.number}`).toBeCloseTo(forward.l, 2);
      }
    }
  });
});
