import { describe, it, expect } from 'vitest';
import { buildConfigJson, parseConfigJson, type ConfigExportInput } from '../src/lib/configExport';
import { defaultConfig } from 'stripper';

const SAMPLE: ConfigExportInput = {
  preset: { primary: 'blue', neutral: null },
  primary: {
    anchors: ['#3B82F6'],
    config: { ...defaultConfig(), contrastMode: 'wcag', hue: { driftLight: 5, driftDark: -5 }, chroma: { taperLight: 0.8, taperDark: 1 } },
  },
  neutral: { anchors: ['#71717a', '#1a0a53'], config: defaultConfig(), tint: 'primary' },
};

describe('config export', () => {
  it('emits the applied configuration per scheme as JSON', () => {
    const json = buildConfigJson({
      preset: { primary: null, neutral: null },
      primary: {
        anchors: ['#8b5cf6'],
        config: { ...defaultConfig(), contrastMode: 'wcag', hue: { driftLight: 5, driftDark: -5 }, chroma: { taperLight: 0.8, taperDark: 1 } },
      },
      neutral: { anchors: ['#71717a', '#1a0a53'], config: defaultConfig(), tint: 'primary' },
    });
    const parsed = JSON.parse(json);
    expect(parsed.primary.anchors).toEqual(['#8b5cf6']);
    expect(parsed.primary.config.contrastMode).toBe('wcag');
    expect(parsed.primary.config.hue.driftLight).toBe(5);
    expect(parsed.primary.config.chroma.taperLight).toBe(0.8);
    expect(parsed.neutral.anchors).toEqual(['#71717a', '#1a0a53']);
    expect(parsed.neutral.tint).toBe('primary');
    expect(parsed.preset).toEqual({ primary: null, neutral: null });
  });

  it('flags active per-scale presets', () => {
    const json = buildConfigJson({
      preset: { primary: 'blue', neutral: null },
      primary: { anchors: ['#3b82f6'], config: defaultConfig() },
      neutral: { anchors: ['#71717a'], config: defaultConfig(), tint: 'own' },
    });
    expect(JSON.parse(json).preset).toEqual({ primary: 'blue', neutral: null });
  });
});

describe('parseConfigJson', () => {
  it('round-trips an exported config back into studio state fields', () => {
    const snapshot = parseConfigJson(buildConfigJson(SAMPLE));
    expect(snapshot).not.toBeNull();
    expect(snapshot!.primaryAnchors).toEqual(['#3b82f6']); // normalized lowercase
    expect(snapshot!.primaryConfig.contrastMode).toBe('wcag');
    expect(snapshot!.primaryConfig.hue.driftLight).toBe(5);
    expect(snapshot!.primaryConfig.hue.driftDark).toBe(-5);
    expect(snapshot!.primaryConfig.chroma.taperLight).toBe(0.8);
    expect(snapshot!.neutralAnchors).toEqual(['#71717a', '#1a0a53']);
    expect(snapshot!.neutralConfig).toEqual(defaultConfig());
    expect(snapshot!.neutralTint).toBe('primary');
    expect(snapshot!.primaryPreset).toBe('blue');
    expect(snapshot!.neutralPreset).toBeNull();
  });

  it('returns null for invalid JSON or missing anchors', () => {
    expect(parseConfigJson('not json {')).toBeNull();
    expect(parseConfigJson('42')).toBeNull();
    expect(parseConfigJson('{}')).toBeNull();
    expect(parseConfigJson(JSON.stringify({ primary: { anchors: ['#3b82f6'] } }))).toBeNull(); // neutral missing
    expect(parseConfigJson(JSON.stringify({ primary: { anchors: ['red'] }, neutral: { anchors: ['#71717a'] } }))).toBeNull();
  });

  it('filters invalid anchors and truncates beyond MAX_ANCHORS', () => {
    const snapshot = parseConfigJson(
      JSON.stringify({
        primary: { anchors: ['#3b82f6', 'nope', '#AABBCC', '#112233', '#445566', '#778899'] },
        neutral: { anchors: ['#71717a'] },
      }),
    );
    expect(snapshot!.primaryAnchors).toEqual(['#3b82f6', '#aabbcc', '#112233', '#445566']);
  });

  it('falls back to defaults for unknown config values and unknown preset ids', () => {
    const snapshot = parseConfigJson(
      JSON.stringify({
        primary: { anchors: ['#3b82f6'], config: { baseMode: 'nonsense', contrastMode: 'nonsense', hue: { driftLight: 999 } } },
        neutral: { anchors: ['#71717a'], tint: 'nonsense' },
        preset: { primary: 'not-a-family', neutral: 'zinc' },
      }),
    );
    expect(snapshot!.primaryConfig).toEqual({ ...defaultConfig(), hue: { ...defaultConfig().hue, driftLight: 60 } });
    expect(snapshot!.neutralTint).toBe('own');
    expect(snapshot!.primaryPreset).toBeNull();
    expect(snapshot!.neutralPreset).toBe('zinc');
  });

  it('migrates the legacy consistentContrast boolean', () => {
    const snapshot = parseConfigJson(
      JSON.stringify({
        primary: { anchors: ['#3b82f6'], config: { consistentContrast: true } },
        neutral: { anchors: ['#71717a'], config: { consistentContrast: false } },
      }),
    );
    expect(snapshot!.primaryConfig.contrastMode).toBe('apca');
    expect(snapshot!.neutralConfig.contrastMode).toBe('none');
  });
});
