import { describe, it, expect } from 'vitest';
import { generateScale, defaultConfig } from '../src/generate';
import { resolveLadderAnchorStep } from '../src/anchor-resolution';

import { stepLc } from './helpers';
import { targetFor } from '../src/targets';
import { SCALE_STEPS, type Oklch, type ScaleStepNumber } from '../src/types';
import { parse, converter } from 'culori';
import { KONVERTO_PRESET } from '../src/presets';

const KONVERTO_PRIMARY = KONVERTO_PRESET.primary.steps;
const KONVERTO_NEUTRAL = KONVERTO_PRESET.neutral.steps;

function engineOklch(hex: string): Oklch {
  const c = toOklch(parse(hex)!);
  return { l: c.l, c: c.c ?? 0, h: c.h ?? 0 };
}

const toOklch = converter('oklch');

describe('defaultConfig', () => {
  it('uses the APCA contrast ladder by default', () => {
    expect(defaultConfig().contrastMode).toBe('apca');
  });

  it('has no tint by default', () => {
    expect(defaultConfig().hue.tint).toBeUndefined();
  });
});

describe('generateScale — tailwindTransfer + APCA (uicolors parity)', () => {
  const scale = generateScale('#a286fd');

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

  it('electric-violet benchmark: APCA Lc within ±4.5 of the Konverto scale per step', () => {
    // The hand-tuned Konverto scale deviates from the uicolors target table by up to
    // ~4 Lc (e.g. step 400 is -63.7 vs the -60 target); generated scales hit the
    // targets themselves within ±2 (tested separately), so ±4.5 covers the drift.
    for (const step of scale.steps) {
      const generated = stepLc(step.hex, step.number);
      const konverto = stepLc(KONVERTO_PRIMARY[step.number]!, step.number);
      expect(Math.abs(generated - konverto), `step ${step.number}`).toBeLessThanOrEqual(4.5);
    }
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

describe('generateScale — no-contrast transfer mode', () => {
  const cfg = { ...defaultConfig(), contrastMode: 'none' as const };

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

describe('generateScale — balancedCurve mode', () => {
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

describe('Konverto scale analysis (documented behavior)', () => {
  it('electric-violet matches the APCA target table within ±4 Lc', () => {
    for (const stepText of Object.keys(KONVERTO_PRIMARY)) {
      const step = Number(stepText) as ScaleStepNumber;
      const target = targetFor(step);
      const value = stepLc(KONVERTO_PRIMARY[step]!, step);
      expect(Math.abs(value - target.lc), `step ${step}`).toBeLessThanOrEqual(4);
    }
  });

  it('holly does NOT follow the APCA table (shipped as exact preset instead)', () => {
    let deviations = 0;
    for (const stepText of Object.keys(KONVERTO_NEUTRAL)) {
      const step = Number(stepText) as ScaleStepNumber;
      const target = targetFor(step);
      const value = stepLc(KONVERTO_NEUTRAL[step]!, step);
      if (Math.abs(value - target.lc) > 4) deviations++;
    }
    expect(deviations).toBeGreaterThan(3);
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
