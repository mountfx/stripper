import { describe, it, expect } from 'vitest';
import { buildConfigJson, parseConfigJson, type ConfigExportInput } from '../src/lib/configExport';
import { defaultConfig } from '@mountfx/stripper';

const SAMPLE: ConfigExportInput = {
  schemes: [
    {
      name: 'brand',
      preset: 'blue',
      anchors: ['#3B82F6'],
      config: { ...defaultConfig(), contrastMode: 'wcag', hue: { driftLight: 5, driftDark: -5 }, chroma: { taperLight: 0.8, taperDark: 1 } },
    },
    { name: 'neutral', preset: null, anchors: ['#71717a', '#1a0a53'], config: defaultConfig() },
  ],
};

describe('config export', () => {
  it('emits the applied configuration per scheme as JSON', () => {
    const json = buildConfigJson({
      schemes: [
        {
          name: 'brand',
          preset: null,
          anchors: ['#8b5cf6'],
          config: { ...defaultConfig(), contrastMode: 'wcag', hue: { driftLight: 5, driftDark: -5 }, chroma: { taperLight: 0.8, taperDark: 1 } },
        },
        { name: 'neutral', preset: null, anchors: ['#71717a', '#1a0a53'], config: defaultConfig() },
      ],
    });
    const parsed = JSON.parse(json);
    expect(parsed.schemes).toHaveLength(2);
    expect(parsed.schemes[0].name).toBe('brand');
    expect(parsed.schemes[0].anchors).toEqual(['#8b5cf6']);
    expect(parsed.schemes[0].config.contrastMode).toBe('wcag');
    expect(parsed.schemes[0].config.hue.driftLight).toBe(5);
    expect(parsed.schemes[0].config.chroma.taperLight).toBe(0.8);
    expect(parsed.schemes[1].anchors).toEqual(['#71717a', '#1a0a53']);
    expect(parsed.schemes[0].preset).toBeNull();
  });

  it('flags active per-scheme presets', () => {
    const json = buildConfigJson({
      schemes: [
        { name: 'primary', preset: 'blue', anchors: ['#3b82f6'], config: defaultConfig() },
        { name: 'neutral', preset: null, anchors: ['#71717a'], config: defaultConfig() },
      ],
    });
    expect(JSON.parse(json).schemes[0].preset).toBe('blue');
    expect(JSON.parse(json).schemes[1].preset).toBeNull();
  });
});

describe('parseConfigJson', () => {
  it('round-trips an exported config back into studio state fields', () => {
    const snapshot = parseConfigJson(buildConfigJson(SAMPLE));
    expect(snapshot).not.toBeNull();
    expect(snapshot!.schemes).toHaveLength(2);
    expect(snapshot!.schemes[0]!.name).toBe('brand');
    expect(snapshot!.schemes[0]!.anchors).toEqual(['#3b82f6']); // normalized lowercase
    expect(snapshot!.schemes[0]!.config.contrastMode).toBe('wcag');
    expect(snapshot!.schemes[0]!.config.hue.driftLight).toBe(5);
    expect(snapshot!.schemes[0]!.config.hue.driftDark).toBe(-5);
    expect(snapshot!.schemes[0]!.config.chroma.taperLight).toBe(0.8);
    expect(snapshot!.schemes[0]!.preset).toBe('blue');
    expect(snapshot!.schemes[1]!.anchors).toEqual(['#71717a', '#1a0a53']);
    expect(snapshot!.schemes[1]!.config).toEqual(defaultConfig());
    expect(snapshot!.schemes[1]!.preset).toBeNull();
  });

  it('returns null for invalid JSON or missing schemes', () => {
    expect(parseConfigJson('not json {')).toBeNull();
    expect(parseConfigJson('42')).toBeNull();
    expect(parseConfigJson('{}')).toBeNull();
    expect(parseConfigJson(JSON.stringify({ schemes: 'nope' }))).toBeNull();
    expect(parseConfigJson(JSON.stringify({ schemes: [] }))).toBeNull();
    expect(parseConfigJson(JSON.stringify({ schemes: [{ anchors: ['red'] }] }))).toBeNull();
  });

  it('drops schemes without usable anchors and keeps the rest', () => {
    const snapshot = parseConfigJson(
      JSON.stringify({
        schemes: [{ name: 'bad', anchors: ['nope'] }, { name: 'good', anchors: ['#71717a'] }],
      }),
    );
    expect(snapshot!.schemes).toHaveLength(1);
    expect(snapshot!.schemes[0]!.name).toBe('good');
  });

  it('filters invalid anchors and truncates beyond MAX_ANCHORS', () => {
    const snapshot = parseConfigJson(
      JSON.stringify({
        schemes: [{ name: 'primary', anchors: ['#3b82f6', 'nope', '#AABBCC', '#112233', '#445566', '#778899'] }],
      }),
    );
    expect(snapshot!.schemes[0]!.anchors).toEqual(['#3b82f6', '#aabbcc', '#112233', '#445566']);
  });

  it('falls back to defaults for unknown config values and unknown preset ids, and names unnamed schemes', () => {
    const snapshot = parseConfigJson(
      JSON.stringify({
        schemes: [
          { anchors: ['#3b82f6'], config: { baseMode: 'nonsense', contrastMode: 'nonsense', hue: { driftLight: 999 } } },
          { name: '  ', anchors: ['#71717a'], preset: 'zinc' },
        ],
      }),
    );
    expect(snapshot!.schemes[0]!.config).toEqual({ ...defaultConfig(), hue: { ...defaultConfig().hue, driftLight: 60 } });
    expect(snapshot!.schemes[0]!.name).toBe('scheme1');
    expect(snapshot!.schemes[1]!.name).toBe('scheme2');
    expect(snapshot!.schemes[1]!.preset).toBe('zinc');
  });

  it('migrates the legacy consistentContrast boolean', () => {
    const snapshot = parseConfigJson(
      JSON.stringify({
        schemes: [
          { anchors: ['#3b82f6'], config: { consistentContrast: true } },
          { anchors: ['#71717a'], config: { consistentContrast: false } },
        ],
      }),
    );
    expect(snapshot!.schemes[0]!.config.contrastMode).toBe('apca');
    expect(snapshot!.schemes[1]!.config.contrastMode).toBe('none');
  });

  it('rejects the old primary/neutral-shaped configs (no legacy support)', () => {
    expect(parseConfigJson(JSON.stringify({ primary: { anchors: ['#3b82f6'] }, neutral: { anchors: ['#71717a'] } }))).toBeNull();
  });
});
