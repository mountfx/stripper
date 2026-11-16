import { describe, it, expect } from 'vitest';
import { generateScale, defaultConfig } from '../src/generate';
import { converter } from 'culori';
import { SCALE_STEPS } from '../src/types';
import { stepLc, stepRatio } from './helpers';
import { targetFor, wcagTargetFor } from '../src/targets';

const toOklch = converter('oklch');

/** WCAG ratio of a hex against black/white per the ladder rule. */
describe('generateScale — multi-anchor basics', () => {
  const anchors = ['#895af6', '#14b8a6']; // light violet + dark teal
  const cfg = defaultConfig();
  const scale = generateScale(anchors, cfg);

  it('produces 11 displayable steps', () => {
    expect(scale.steps).toHaveLength(11);
    for (const step of scale.steps) {
      expect(step.hex).toMatch(/^#[0-9a-f]{6}$/);
      const back = toOklch(step.hex)!;
      expect(back.l).toBeCloseTo(step.oklch.l, 2);
    }
  });

  it('anchors metadata resolves both colors to distinct steps', () => {
    expect(scale.anchors).toHaveLength(2);
    const steps = scale.anchors!.map((a) => a.step);
    expect(new Set(steps).size).toBe(2);
    expect(scale.anchors!.map((a) => a.hex)).toEqual(anchors);
    expect(scale.anchorStep).toBe(scale.anchors![0]!.step);
  });

  it('aesthetic mode: anchor steps reproduce the brand hue & chroma exactly', () => {
    const none = generateScale(anchors, { ...defaultConfig(), contrastMode: 'none' });
    for (const anchor of none.anchors!) {
      const step = none.steps.find((s) => s.number === anchor.step)!;
      const expected = toOklch(anchor.hex)!;
      expect(step.oklch.h).toBeCloseTo(expected.h ?? 0, 1);
      expect(step.oklch.c).toBeCloseTo(expected.c, 2);
      expect(step.oklch.l).toBeCloseTo(expected.l, 2);
    }
  });

  it('hue interpolates monotonically (shortest arc) between anchors', () => {
    const none = generateScale(anchors, { ...defaultConfig(), contrastMode: 'none' });
    const anchorHues = none.anchors!.map((a) => toOklch(a.hex)!.h ?? 0);
    const delta = ((anchorHues[1]! - anchorHues[0]! + 540) % 360) - 180;
    const hueAt = (i: number) => {
      const t = i / 10;
      let h = anchorHues[0]! + delta * t;
      h = ((h % 360) + 360) % 360;
      return h;
    };
    // interior steps between the two anchors follow the linear arc within tolerance
    for (const step of none.steps) {
      const idx = SCALE_STEPS.indexOf(step.number);
      const a0 = SCALE_STEPS.indexOf(none.anchors![0]!.step);
      const a1 = SCALE_STEPS.indexOf(none.anchors![1]!.step);
      if (idx > a0 && idx < a1) {
        const t = (idx - a0) / (a1 - a0);
        const expected = hueAt(Math.round(t * 10));
        expect(Math.abs(((step.oklch.h - expected + 540) % 360) - 180)).toBeLessThan(4);
      }
    }
  });

  it('ladder modes still hit their contracts (hue/chroma carry through)', () => {
    const apcaScale = generateScale(anchors, { ...defaultConfig(), contrastMode: 'apca' });
    for (const step of apcaScale.steps) {
      const target = targetFor(step.number);
      const achieved = stepLc(step.hex, step.number);
      expect(Math.abs(achieved - target.lc), `apca step ${step.number}`).toBeLessThanOrEqual(2);
    }
    const wcagScale = generateScale(anchors, { ...defaultConfig(), contrastMode: 'wcag' });
    for (const step of wcagScale.steps) {
      const target = wcagTargetFor(step.number);
      const achieved = stepRatio(step.hex, step.number);
      expect(Math.abs(achieved - target.ratio), `wcag step ${step.number}`).toBeLessThanOrEqual(0.1);
    }
  });

  it('anchor hues survive the ladder (chroma not erased)', () => {
    const apcaScale = generateScale(anchors, { ...defaultConfig(), contrastMode: 'apca' });
    for (const anchor of apcaScale.anchors!) {
      const step = apcaScale.steps.find((s) => s.number === anchor.step)!;
      const expected = toOklch(anchor.hex)!;
      expect(Math.abs(((step.oklch.h - (expected.h ?? 0) + 540) % 360) - 180)).toBeLessThan(10);
      expect(step.oklch.c).toBeGreaterThan(expected.c * 0.6);
    }
  });
});

describe('generateScale — multi-anchor conflicts and caps', () => {
  it('two anchors desiring the same step get auto-placed with a warning', () => {
    // both mid-tone violets will desire the same neighborhood
    const scale = generateScale(['#8b5cf6', '#7c3aed'], { ...defaultConfig(), contrastMode: 'none' });
    const steps = scale.anchors!.map((a) => a.step);
    expect(new Set(steps).size).toBe(2);
    expect(scale.warnings.some((w) => w.includes('unavailable') || w.includes('similar lightness'))).toBe(true);
  });

  it('more than 4 anchors are truncated with a warning', () => {
    const scale = generateScale(['#895af6', '#14b8a6', '#f97316', '#ec4899', '#84cc16'], { ...defaultConfig() });
    expect(scale.anchors).toHaveLength(4);
    expect(scale.warnings.some((w) => w.includes('at most 4'))).toBe(true);
  });

  it('explicit anchor steps are honored when free', () => {
    const scale = generateScale(
      [
        { hex: '#895af6', anchor: 600 },
        { hex: '#f5f7ff', anchor: 100 },
      ],
      { ...defaultConfig(), contrastMode: 'none' },
    );
    const byHex = new Map(scale.anchors!.map((a) => [a.hex, a.step]));
    expect(byHex.get('#895af6')).toBe(600);
    expect(byHex.get('#f5f7ff')).toBe(100);
    const step = scale.steps.find((s) => s.number === 600)!;
    expect(step.hex).toBe('#895af6');
  });

  it('single anchor with explicit step still pins exactly (back-compat path)', () => {
    const scale = generateScale([{ hex: '#895af6', anchor: 700 }], { ...defaultConfig(), contrastMode: 'none' });
    expect(scale.anchorStep).toBe(700);
    const step = scale.steps.find((s) => s.number === 700)!;
    expect(step.hex).toBe('#895af6');
  });
});
