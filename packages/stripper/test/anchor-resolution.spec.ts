import { describe, it, expect } from 'vitest';
import { generateScale, defaultConfig } from '../src/generate';
import { resolveLadderAnchorStep } from '../src/anchor-resolution';
import { oklchOfHex } from '../src/gamut';
import { wcagTargetFor } from '../src/targets';
import { wcagRatio } from '../src/wcag';
import { SCALE_STEPS, type Oklch, type ScaleStepNumber } from '../src/types';

function engineOklch(hex: string): Oklch {
  const c = oklchOfHex(hex);
  return { l: c.l, c: c.c ?? 0, h: c.h ?? 0 };
}

describe('ladder-aware anchor resolution', () => {
  it('reported case: #f25f57 with WCAG ladder resolves to step 400 (6.55:1 vs black ≈ 6.5 target)', () => {
    const scale = generateScale('#f25f57', {
      ...defaultConfig(),
      contrastMode: 'wcag',
      keepAnchorsExact: true,
    });
    expect(scale.anchorStep).toBe(400);
    const kept = scale.steps.find((s) => s.number === 400)!;
    expect(kept.hex).toBe('#f25f57');
    expect(kept.kept).toBe(true);
    // the kept color sits in-contract: 6.55:1 vs the 6.5 target
    const achieved = wcagRatio(kept.hex, '#000000');
    expect(achieved).toBeCloseTo(6.55, 1);
    expect(Math.abs(achieved - wcagTargetFor(400).ratio)).toBeLessThanOrEqual(0.1);
    // no deviation warning
    expect(scale.warnings.some((w) => w.includes('kept exact'))).toBe(false);
  });

  it('without keepAnchorsExact, the same input anchors at 400 and is ladder-solved there', () => {
    const scale = generateScale('#f25f57', { ...defaultConfig(), contrastMode: 'wcag' });
    expect(scale.anchorStep).toBe(400);
    const anchor = scale.steps.find((s) => s.number === 400)!;
    expect(anchor.hex).not.toBe('#f25f57'); // lightness re-solved to hit 6.5:1 exactly
    const achieved = wcagRatio(anchor.hex, '#000000');
    expect(Math.abs(achieved - wcagTargetFor(400).ratio)).toBeLessThanOrEqual(0.1);
  });

  it('apca mode: resolution minimizes ladder distortion', () => {
    const inputOk = engineOklch('#a286fd');
    const expected = resolveLadderAnchorStep(inputOk, { ...defaultConfig(), contrastMode: 'apca' });
    const scale = generateScale('#a286fd', { ...defaultConfig(), contrastMode: 'apca' });
    expect(scale.anchorStep).toBe(expected);
    // and the kept variant of the same input lands on the same step, in-contract
    const kept = generateScale('#a286fd', { ...defaultConfig(), contrastMode: 'apca', keepAnchorsExact: true });
    expect(kept.anchorStep).toBe(expected);
  });

  it('none mode: resolution follows the base-curve lightness matching', () => {
    // #a286fd in none mode: transfer lightness matching puts it at 400 (HSL-based)
    const transfer = generateScale('#a286fd', {
      ...defaultConfig(),
      baseMode: 'tailwindTransfer',
      contrastMode: 'none',
    });
    expect(transfer.anchorStep).toBe(400);
    const anchor = transfer.steps.find((s) => s.number === 400)!;
    expect(anchor.hex).toBe('#a286fd'); // pinned exactly in none mode
    // the balanced curve (the default) matches against the averaged profile instead
    const balanced = generateScale('#a286fd', { ...defaultConfig(), contrastMode: 'none' });
    expect(balanced.anchorStep).toBe(500);
  });

  it('explicit anchors always win over the ladder-aware resolution', () => {
    const scale = generateScale([{ hex: '#f25f57', anchor: 500 }], {
      ...defaultConfig(),
      contrastMode: 'wcag',
      keepAnchorsExact: true,
    });
    expect(scale.anchorStep).toBe(500);
    const kept = scale.steps.find((s) => s.number === 500)!;
    expect(kept.hex).toBe('#f25f57');
    // insisting on 500 keeps the exact color but out-of-contract: deviation warning fires
    expect(scale.warnings.some((w) => w.includes('kept exact') && w.includes('500'))).toBe(true);
  });

  it('unreachable targets steer placement to feasible neighbors', () => {
    // a highly saturated yellow cannot reach dark-step ratio targets; distortion is huge
    // there, so the resolution must not place it at the dark end
    const inputOk = engineOklch('#facc15'); // yellow, L ~0.85
    const step = resolveLadderAnchorStep(inputOk, { ...defaultConfig(), contrastMode: 'wcag' });
    expect(SCALE_STEPS.indexOf(step)).toBeLessThanOrEqual(SCALE_STEPS.indexOf(500 as ScaleStepNumber));
  });

  it('multi-anchor: ladder-aware desired steps (distinctness and monotone lightness preserved)', () => {
    const scale = generateScale(['#895af6', '#14b8a6'], { ...defaultConfig(), contrastMode: 'wcag' });
    const steps = scale.anchors!.map((a) => a.step);
    expect(new Set(steps).size).toBe(2);
    const lights = scale.anchors!.map((a) => ({ step: a.step, l: oklchOfHex(a.hex).l }));
    const sorted = [...lights].sort((x, y) => x.l - y.l);
    // ascending lightness must map to descending step numbers
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]!.step).toBeLessThan(sorted[i - 1]!.step);
    }
    // ladder adherence intact for every step (WCAG ladder, since contrastMode is 'wcag')
    for (const s of scale.steps) {
      const t = wcagTargetFor(s.number as ScaleStepNumber);
      const bg = t.bg === 'black' ? '#000000' : '#ffffff';
      expect(Math.abs(wcagRatio(s.hex, bg) - t.ratio)).toBeLessThanOrEqual(0.1);
    }
  });
});
