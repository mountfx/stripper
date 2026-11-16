import { describe, it, expect } from 'vitest';
import { TAILWIND_FAMILIES, GRAY_FAMILY_NAMES, familyById, scaleFromFamily } from '../src/families';
import { SCALE_STEPS } from '../src/types';

describe('TAILWIND_FAMILIES', () => {
  it('contains the 22 Tailwind v4 families with 11 shades each', () => {
    expect(TAILWIND_FAMILIES).toHaveLength(22);
    for (const family of TAILWIND_FAMILIES) {
      expect(family.shades).toHaveLength(11);
      expect(family.shades.map((s) => s.number)).toEqual([...SCALE_STEPS]);
      for (const shade of family.shades) {
        expect(shade.hex).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it('marks the gray families', () => {
    const grayIds = TAILWIND_FAMILIES.filter((f) => GRAY_FAMILY_NAMES.has(f.name)).map((f) => f.id);
    expect(grayIds).toEqual(['slate', 'gray', 'zinc', 'neutral', 'stone']);
  });
});

describe('familyById', () => {
  it('resolves known ids', () => {
    expect(familyById('blue')?.name).toBe('Blue');
    expect(familyById('stone')?.name).toBe('Stone');
  });

  it('returns undefined for unknown ids', () => {
    expect(familyById('nope')).toBeUndefined();
  });
});

describe('scaleFromFamily', () => {
  it('reproduces the exact family hexes anchored at 500', () => {
    const blue = familyById('blue')!;
    const scale = scaleFromFamily(blue);
    expect(scale.input).toBe('#3b82f6');
    expect(scale.anchorStep).toBe(500);
    expect(scale.anchors).toEqual([{ step: 500, hex: '#3b82f6' }]);
    expect(scale.closestFamily).toBe('Blue');
    expect(scale.warnings).toEqual([]);
    for (const shade of blue.shades) {
      const step = scale.steps.find((s) => s.number === shade.number)!;
      expect(step.hex).toBe(shade.hex);
    }
  });

  it('derives valid oklch/hsl per step', () => {
    const scale = scaleFromFamily(familyById('red')!);
    for (const step of scale.steps) {
      expect(step.oklch.l).toBeGreaterThan(0);
      expect(step.oklch.l).toBeLessThanOrEqual(1);
      expect(step.hsl.h).toBeGreaterThanOrEqual(0);
    }
  });
});
