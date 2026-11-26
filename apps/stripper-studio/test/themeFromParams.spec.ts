import { describe, it, expect } from 'vitest';
import type { Scale } from '@mountfx/stripper';
import {
  DEFAULT_SCHEMES,
  sanitizeName,
  stateFromParams,
  paramsFromState,
  generateScheme,
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
  it('returns the documented default schemes for an empty query', () => {
    const p = stateFromParams(params(''));
    expect(p.schemes).toHaveLength(2);
    expect(p.schemes[0]).toEqual({ name: 'primary', anchors: [DEFAULT_SCHEMES[0]!.anchor], config: expect.anything(), preset: null });
    expect(p.schemes[1]).toEqual({ name: 'neutral', anchors: [DEFAULT_SCHEMES[1]!.anchor], config: expect.anything(), preset: null });
    expect(p.schemes[0]!.config.baseMode).toBe('balancedCurve');
    expect(p.schemes[0]!.config.contrastMode).toBe('apca');
  });

  it('reads anchors from s1/s1_2..s1_4 per scheme', () => {
    const p = stateFromParams(params('?s1=%23ff0000&s1_2=%2300ff00&s1_3=%230000ff&s2=%23123456'));
    expect(p.schemes[0]!.anchors).toEqual(['#ff0000', '#00ff00', '#0000ff']);
    expect(p.schemes[1]!.anchors).toEqual(['#123456']);
  });

  it('caps anchors at MAX_ANCHORS', () => {
    const p = stateFromParams(params('?s1=%23ff0000&s1_2=%2300ff00&s1_3=%230000ff&s1_4=%23ffffff&s1_5=%23111111'));
    expect(p.schemes[0]!.anchors).toHaveLength(4);
  });

  it('decodes base64 configs and ignores malformed ones', () => {
    const cfg = btoa(JSON.stringify({ contrastMode: 'none' }));
    const bad = btoa('not-json');
    const p = stateFromParams(params(`?s1=x&s1cfg=${cfg}&s2=x&s2cfg=${bad}`));
    expect(p.schemes[0]!.config.contrastMode).toBe('none');
    expect(p.schemes[1]!.config.contrastMode).toBe('apca'); // fallback intact
  });

  it('accepts valid presets and ignores unknown ones', () => {
    const p = stateFromParams(params('?s1preset=violet&s2preset=not-a-family&s2=%23123456'));
    expect(p.schemes[0]!.preset).toBe('violet');
    expect(p.schemes[1]!.preset).toBeNull();
  });

  it('falls back to the preset 500 shade when only a preset is given', () => {
    const p = stateFromParams(params('?s1preset=violet'));
    expect(p.schemes[0]!.anchors).toEqual(['#8b5cf6']); // violet-500
    expect(p.schemes[0]!.preset).toBe('violet');
  });

  it('counts schemes by indexed params and keeps gaps as separate schemes', () => {
    const p = stateFromParams(params('?s1=%23ff0000&s2preset=stone'));
    expect(p.schemes).toHaveLength(2);
    expect(p.schemes[1]!.preset).toBe('stone');
    expect(p.schemes[1]!.anchors).toEqual(['#78716c']); // stone-500
  });

  it('sanitizes scheme names with an index fallback', () => {
    const p = stateFromParams(params('?s1=%23ff0000&s2=%2300ff00&s2name=my%20Brand%21&s3=%230000ff&s3name=---'));
    expect(p.schemes[0]!.name).toBe('scheme1');
    expect(p.schemes[1]!.name).toBe('my-Brand');
    expect(p.schemes[2]!.name).toBe('scheme3');
  });

  it('old p/n links fall back to the defaults (no legacy support)', () => {
    const p = stateFromParams(params('?p=%23ff0000&n=%23123456&pcfg=e30&ntint=primary'));
    expect(p.schemes).toHaveLength(2);
    expect(p.schemes[0]!.anchors).toEqual([DEFAULT_SCHEMES[0]!.anchor]);
    expect(p.schemes[1]!.anchors).toEqual([DEFAULT_SCHEMES[1]!.anchor]);
  });
});

describe('paramsFromState', () => {
  const SEEDED = '?s1=%23895af6&s1_2=%2314b8a6&s2=%2371717a&s2cfg=eyJjb250cmFzdE1vZGUiOiJub25lIn0=&s1preset=violet&s1name=brand&s2name=neutral';

  it('round-trips through stateFromParams', () => {
    const seeded = stateFromParams(params(SEEDED));
    const roundTripped = stateFromParams(paramsFromState(seeded));
    expect(roundTripped).toEqual(seeded);
  });

  it('serializes every param the studio URL carries', () => {
    const seeded = stateFromParams(params(SEEDED));
    const q = paramsFromState(seeded);
    expect(q.get('s1')).toBe('#895af6');
    expect(q.get('s1_2')).toBe('#14b8a6');
    expect(q.get('s2')).toBe('#71717a');
    // the full config is serialized (the seed's partial config merged over defaults)
    expect(JSON.parse(atob(q.get('s1cfg')!))).toMatchObject({ contrastMode: 'apca' });
    expect(JSON.parse(atob(q.get('s2cfg')!))).toMatchObject({ contrastMode: 'none' });
    expect(q.get('s1preset')).toBe('violet');
    expect(q.get('s1name')).toBe('brand');
    expect(q.get('s2name')).toBe('neutral');
  });

  it('includes dark only when set', () => {
    const lit = stateFromParams(params(''));
    expect(paramsFromState({ ...lit, dark: false }).has('dark')).toBe(false);
    expect(paramsFromState({ ...lit, dark: true }).get('dark')).toBe('1');
  });
});

describe('generateScheme', () => {
  it('generates an 11-step scale from the default anchor', () => {
    const { scale, error } = generateScheme({
      preset: null,
      anchors: [DEFAULT_SCHEMES[0]!.anchor],
      config: stateFromParams(params('')).schemes[0]!.config,
    });
    expect(error).toBeNull();
    expect(scale!.steps).toHaveLength(11);
    expect(scale!.input).toBe(DEFAULT_SCHEMES[0]!.anchor);
  });

  it('an active preset short-circuits to the exact Tailwind scale', () => {
    const { scale, error } = generateScheme({ preset: 'violet', anchors: ['#000000'], config: stateFromParams(params('')).schemes[0]!.config });
    expect(error).toBeNull();
    expect(hexes(scale!).get('500')).toBe('#8b5cf6');
    expect(scale!.closestFamily).toBe('Violet');
  });

  it('surfaces engine errors instead of throwing', () => {
    const { scale, error } = generateScheme({ preset: null, anchors: ['zzz'], config: stateFromParams(params('')).schemes[0]!.config });
    expect(scale).toBeNull();
    expect(error).toContain('Unparseable color');
  });
});

describe('themeFromParams', () => {
  it('derives every scheme from the defaults', () => {
    const { scales, error } = themeFromParams(params(''));
    expect(error).toBeNull();
    expect(scales).toHaveLength(2);
    expect(scales![0]!.name).toBe('primary');
    expect(scales![1]!.name).toBe('neutral');
    expect(scales![0]!.scale.steps).toHaveLength(11);
    expect(scales![1]!.scale.steps).toHaveLength(11);
  });

  it('derives scales from a full studio URL (anchors, configs, presets, names)', () => {
    const { scales, error } = themeFromParams(params('?s1=%23895af6&s1preset=violet&s2=%2371717a&s2preset=zinc&s2name=neutrals'));
    expect(error).toBeNull();
    expect(hexes(scales![0]!.scale).get('500')).toBe('#8b5cf6');
    expect(scales![0]!.name).toBe('scheme1'); // no s1name param → indexed fallback
    expect(hexes(scales![1]!.scale).get('500')).toBe('#71717a');
    expect(scales![1]!.name).toBe('neutrals');
  });

  it('supports more than two schemes', () => {
    const { scales, error } = themeFromParams(params('?s1=%23ff0000&s2=%2300ff00&s3=%230000ff&s3name=accent'));
    expect(error).toBeNull();
    expect(scales).toHaveLength(3);
    expect(scales![2]!.name).toBe('accent');
  });

  it('surfaces generation errors', () => {
    const { scales, error } = themeFromParams(params('?s1=zzz'));
    expect(scales).toBeNull();
    expect(error).toContain('Unparseable color');
  });
});

describe('sanitizeName', () => {
  it('keeps token-safe names and normalizes separators', () => {
    expect(sanitizeName('My Brand', 0)).toBe('My-Brand');
    expect(sanitizeName('  brand_v2  ', 0)).toBe('brand_v2');
  });

  it('falls back to the indexed name for junk input', () => {
    expect(sanitizeName('!!!', 2)).toBe('scheme3');
    expect(sanitizeName(null, 0)).toBe('scheme1');
  });
});
