import { describe, it, expect } from 'vitest';
import { generateScale, defaultConfig } from '../src/generate';
import { targetFor, wcagTargetFor } from '../src/targets';
import { lc } from '../src/apca';
import { wcagRatio } from '../src/wcag';
import type { ScaleStepNumber } from '../src/types';

describe('generateScale — keepAnchorsExact under ladders', () => {
  it('single anchor, APCA: anchor step keeps the input hex byte-exact; others hit the ladder', () => {
    const scale = generateScale('#a286fd', { ...defaultConfig(), keepAnchorsExact: true });
    const anchor = scale.steps.find((s) => s.number === scale.anchorStep)!;
    expect(anchor.hex).toBe('#a286fd');
    expect(anchor.kept).toBe(true);
    for (const step of scale.steps) {
      if (step.number === scale.anchorStep) continue;
      const target = targetFor(step.number as ScaleStepNumber);
      const achieved = lc(step.hex, target.bg === 'black' ? '#000000' : '#ffffff');
      expect(Math.abs(achieved - target.lc), `step ${step.number}`).toBeLessThanOrEqual(2);
      expect(step.kept).toBeFalsy();
    }
  });

  it('single anchor, WCAG: same behavior with ratio ladder', () => {
    const scale = generateScale('#a286fd', { ...defaultConfig(), contrastMode: 'wcag', keepAnchorsExact: true });
    const anchor = scale.steps.find((s) => s.number === scale.anchorStep)!;
    expect(anchor.hex).toBe('#a286fd');
    expect(anchor.kept).toBe(true);
    for (const step of scale.steps) {
      if (step.number === scale.anchorStep) continue;
      const target = wcagTargetFor(step.number as ScaleStepNumber);
      const achieved = wcagRatio(step.hex, target.bg === 'black' ? '#000000' : '#ffffff');
      expect(Math.abs(achieved - target.ratio), `step ${step.number}`).toBeLessThanOrEqual(0.1);
    }
  });

  it('warns when the kept anchor deviates from its ladder target', () => {
    // #f5f7ff is very light; at its natural step (50) the target is -103 vs black — close,
    // so force a mid step where deviation is large
    const scale = generateScale([{ hex: '#f5f7ff', anchor: 500 }], {
      ...defaultConfig(),
      keepAnchorsExact: true,
    });
    const kept = scale.steps.find((s) => s.number === 500)!;
    expect(kept.hex).toBe('#f5f7ff');
    const achieved = Math.abs(lc(kept.hex, '#ffffff'));
    expect(achieved).toBeLessThan(53); // far below the +55 target
    expect(scale.warnings.some((w) => w.includes('kept exact') && w.includes('500'))).toBe(true);
  });

  it('no deviation warning when the kept anchor sits near its target', () => {
    // #a286fd anchored at 500: |Lc(text on white)| 54.4 vs the +55 target — within tolerance
    const scale = generateScale([{ hex: '#a286fd', anchor: 500 }], { ...defaultConfig(), keepAnchorsExact: true });
    const kept = scale.steps.find((s) => s.number === 500)!;
    expect(kept.hex).toBe('#a286fd');
    const target = targetFor(500);
    const achieved = lc(kept.hex, target.bg === 'black' ? '#000000' : '#ffffff');
    expect(Math.abs(Math.abs(achieved) - Math.abs(target.lc))).toBeLessThanOrEqual(2);
    expect(scale.warnings.some((w) => w.includes('kept exact'))).toBe(false);
  });

  it('multi-anchor: every anchor stays byte-exact; mid steps still hit the ladder', () => {
    const scale = generateScale(['#895af6', '#14b8a6'], { ...defaultConfig(), keepAnchorsExact: true });
    for (const anchor of scale.anchors!) {
      const step = scale.steps.find((s) => s.number === anchor.step)!;
      expect(step.hex).toBe(anchor.hex);
      expect(step.kept).toBe(true);
    }
    for (const step of scale.steps) {
      if (scale.anchors!.some((a) => a.step === step.number)) continue;
      const target = targetFor(step.number);
      const achieved = lc(step.hex, target.bg === 'black' ? '#000000' : '#ffffff');
      expect(Math.abs(achieved - target.lc), `step ${step.number}`).toBeLessThanOrEqual(2);
    }
  });

  it('none mode: no-op (no kept flags, same output with or without the flag)', () => {
    const without = generateScale('#a286fd', { ...defaultConfig(), contrastMode: 'none' });
    const withFlag = generateScale('#a286fd', {
      ...defaultConfig(),
      contrastMode: 'none',
      keepAnchorsExact: true,
    });
    expect(withFlag.steps.map((s) => s.hex)).toEqual(without.steps.map((s) => s.hex));
    expect(withFlag.steps.every((s) => !s.kept)).toBe(true);
  });

  it('warns when a kept anchor inverts the lightness ramp', () => {
    // light color forced at a dark step
    const scale = generateScale([{ hex: '#f5f7ff', anchor: 700 }], {
      ...defaultConfig(),
      contrastMode: 'none',
    });
    expect(scale.warnings.some((w) => w.includes('not monotone'))).toBe(true);
  });

  it('does not emit a monotonicity warning for well-placed scales', () => {
    const scale = generateScale('#a286fd', { ...defaultConfig(), keepAnchorsExact: true });
    expect(scale.warnings.some((w) => w.includes('not monotone'))).toBe(false);
  });
});
