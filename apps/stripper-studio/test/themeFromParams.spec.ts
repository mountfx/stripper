import { describe, it, expect } from 'vitest';
import type { Scale } from 'stripper';
import {
  DEFAULT_PRIMARY_ANCHOR,
  DEFAULT_NEUTRAL_ANCHOR,
  stateFromParams,
  paramsFromState,
  generatePrimary,
  generateNeutral,
  themeFromParams,
} from '../src/lib/themeFromParams';

function params(qs: string): URLSearchParams {
  return new URLSearchParams(qs);
}

/** step-number → hex map for compact assertions */
function hexes(scale: Scale): Map<string, string> {
  return new Map(scale.steps.map((s) => [String(s.number), s.hex]));
}

describe('stateFromParams', () => {
  it('returns the documented defaults for an empty query', () => {
    const p = stateFromParams(params(''));
    expect(p.primaryAnchors).toEqual([DEFAULT_PRIMARY_ANCHOR]);
    expect(p.neutralAnchors).toEqual([DEFAULT_NEUTRAL_ANCHOR]);
    expect(p.primaryPreset).toBeNull();
    expect(p.neutralPreset).toBeNull();
    expect(p.neutralTint).toBe('own');
    expect(p.primaryConfig.baseMode).toBe('balancedCurve');
    expect(p.primaryConfig.contrastMode).toBe('apca');
  });

  it('reads anchors from p/p2..p4 and n/n2..n4', () => {
    const p = stateFromParams(params('?p=%23ff0000&p2=%2300ff00&p3=%230000ff&n=%23123456'));
    expect(p.primaryAnchors).toEqual(['#ff0000', '#00ff00', '#0000ff']);
    expect(p.neutralAnchors).toEqual(['#123456']);
  });

  it('caps anchors at MAX_ANCHORS', () => {
    const p = stateFromParams(params('?p=%23ff0000&p2=%2300ff00&p3=%230000ff&p4=%23ffffff&p5=%23111111'));
    expect(p.primaryAnchors).toHaveLength(4);
  });

  it('decodes base64 configs and ignores malformed ones', () => {
    const cfg = btoa(JSON.stringify({ contrastMode: 'none' }));
    const bad = btoa('not-json');
    const p = stateFromParams(params(`?pcfg=${cfg}&ncfg=${bad}`));
    expect(p.primaryConfig.contrastMode).toBe('none');
    expect(p.neutralConfig.contrastMode).toBe('apca'); // fallback intact
  });

  it('accepts valid presets and ignores unknown ones', () => {
    const p = stateFromParams(params('?ppreset=violet&npreset=not-a-family'));
    expect(p.primaryPreset).toBe('violet');
    expect(p.neutralPreset).toBeNull();
  });

  it('falls back to the preset 500 shade when only a preset is given', () => {
    const p = stateFromParams(params('?ppreset=violet'));
    expect(p.primaryAnchors).toEqual(['#8b5cf6']); // violet-500
  });

  it('maps ntint to the enum and ignores junk values', () => {
    expect(stateFromParams(params('?ntint=primary')).neutralTint).toBe('primary');
    expect(stateFromParams(params('?ntint=own')).neutralTint).toBe('own');
    expect(stateFromParams(params('?ntint=zzz')).neutralTint).toBe('own');
  });
});

describe('paramsFromState', () => {
  const SEEDED = '?p=%23895af6&p2=%2314b8a6&n=%2371717a&pcfg=eyJjb250cmFzdE1vZGUiOiJub25lIn0=&ntint=primary&ppreset=violet&npreset=stone';

  it('round-trips through stateFromParams', () => {
    const seeded = stateFromParams(params(SEEDED));
    const roundTripped = stateFromParams(paramsFromState(seeded));
    expect(roundTripped).toEqual(seeded);
  });

  it('serializes every param the studio URL carries', () => {
    const seeded = stateFromParams(params(SEEDED));
    const q = paramsFromState(seeded);
    expect(q.get('p')).toBe('#895af6');
    expect(q.get('p2')).toBe('#14b8a6');
    expect(q.get('n')).toBe('#71717a');
    // the full config is serialized (the seed's partial config merged over defaults)
    expect(JSON.parse(atob(q.get('pcfg')!))).toMatchObject({ contrastMode: 'none' });
    expect(q.get('ntint')).toBe('primary');
    expect(q.get('ppreset')).toBe('violet');
    expect(q.get('npreset')).toBe('stone');
  });

  it('includes dark only when set', () => {
    const lit = stateFromParams(params(''));
    expect(paramsFromState({ ...lit, dark: false }).has('dark')).toBe(false);
    expect(paramsFromState({ ...lit, dark: true }).get('dark')).toBe('1');
  });
});

describe('generatePrimary', () => {
  it('generates an 11-step scale from the default anchor', () => {
    const { scale, error } = generatePrimary({
      preset: null,
      anchors: [DEFAULT_PRIMARY_ANCHOR],
      config: stateFromParams(params('')).primaryConfig,
    });
    expect(error).toBeNull();
    expect(scale!.steps).toHaveLength(11);
    expect(scale!.input).toBe(DEFAULT_PRIMARY_ANCHOR);
  });

  it('an active preset short-circuits to the exact Tailwind scale', () => {
    const { scale, error } = generatePrimary({ preset: 'violet', anchors: ['#000000'], config: stateFromParams(params('')).primaryConfig });
    expect(error).toBeNull();
    expect(hexes(scale!).get('500')).toBe('#8b5cf6');
    expect(scale!.closestFamily).toBe('Violet');
  });

  it('surfaces engine errors instead of throwing', () => {
    const { scale, error } = generatePrimary({ preset: null, anchors: ['zzz'], config: stateFromParams(params('')).primaryConfig });
    expect(scale).toBeNull();
    expect(error).toContain('Unparseable color');
  });
});

describe('generateNeutral', () => {
  it('tint borrow: the neutral scale follows the primary hue', () => {
    const p = stateFromParams(params('?p=%23ff0000&n=%23a49aa8&ntint=primary'));
    const tinted = generateNeutral({
      preset: null,
      anchors: p.neutralAnchors,
      config: p.neutralConfig,
      tint: 'primary',
      primaryAnchors: p.primaryAnchors,
    });
    const untinted = generateNeutral({
      preset: null,
      anchors: p.neutralAnchors,
      config: p.neutralConfig,
      tint: 'own',
      primaryAnchors: p.primaryAnchors,
    });
    expect(tinted.scale).not.toBeNull();
    expect(untinted.scale).not.toBeNull();
    // the tinted neutral's hue is pulled toward the primary anchor's red hue
    const hueAt = (scale: Scale, step: number) => scale.steps.find((s) => s.number === step)!.oklch.h;
    const dist = (h: number, target: number) => Math.min(Math.abs(h - target), 360 - Math.abs(h - target));
    const tintedHue = hueAt(tinted.scale!, 500);
    const untintedHue = hueAt(untinted.scale!, 500);
    expect(dist(tintedHue, 27)).toBeLessThan(dist(untintedHue, 27));
    expect(hexes(tinted.scale!).get('500')).not.toBe(hexes(untinted.scale!).get('500'));
  });

  it('skips tint when the primary anchor is unparseable (no crash)', () => {
    const p = stateFromParams(params('?p=zzz&n=%23a49aa8&ntint=primary'));
    const { scale, error } = generateNeutral({
      preset: null,
      anchors: p.neutralAnchors,
      config: p.neutralConfig,
      tint: 'primary',
      primaryAnchors: p.primaryAnchors,
    });
    expect(scale).not.toBeNull();
    expect(error).toBeNull();
  });

  it('an active preset short-circuits to the exact Tailwind scale', () => {
    const { scale } = generateNeutral({
      preset: 'zinc',
      anchors: [DEFAULT_NEUTRAL_ANCHOR],
      config: stateFromParams(params('')).neutralConfig,
      tint: 'own',
      primaryAnchors: [],
    });
    expect(hexes(scale!).get('500')).toBe('#71717a');
  });
});

describe('themeFromParams', () => {
  it('derives both scales from defaults', () => {
    const { scales, error } = themeFromParams(params(''));
    expect(error).toBeNull();
    expect(scales).toHaveLength(2);
    expect(scales![0]!.name).toBe('primary');
    expect(scales![1]!.name).toBe('neutral');
    expect(scales![0]!.scale.steps).toHaveLength(11);
    expect(scales![1]!.scale.steps).toHaveLength(11);
  });

  it('derives scales from a full studio URL (anchors, configs, presets, tint)', () => {
    const { scales, error } = themeFromParams(params('?p=%23895af6&n=%2371717a&ppreset=violet&npreset=zinc&ntint=primary'));
    expect(error).toBeNull();
    expect(hexes(scales![0]!.scale).get('500')).toBe('#8b5cf6');
    expect(hexes(scales![1]!.scale).get('500')).toBe('#71717a');
  });

  it('surfaces generation errors', () => {
    const { scales, error } = themeFromParams(params('?p=zzz'));
    expect(scales).toBeNull();
    expect(error).toContain('Unparseable color');
  });
});
