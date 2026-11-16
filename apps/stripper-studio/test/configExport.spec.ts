import { describe, it, expect } from 'vitest';
import { buildConfigJson } from '../src/lib/configExport';
import { defaultConfig } from 'stripper';

describe('config export', () => {
  it('emits the applied configuration per scheme as JSON', () => {
    const json = buildConfigJson({
      presetMode: false,
      primary: {
        anchors: ['#a286fd'],
        config: { ...defaultConfig(), contrastMode: 'wcag', hue: { driftLight: 5, driftDark: -5 }, chroma: { taperLight: 0.8, taperDark: 1 } },
      },
      neutral: { anchors: ['#798680', '#1a0a53'], config: defaultConfig(), tint: 'primary' },
    });
    const parsed = JSON.parse(json);
    expect(parsed.primary.anchors).toEqual(['#a286fd']);
    expect(parsed.primary.config.contrastMode).toBe('wcag');
    expect(parsed.primary.config.hue.driftLight).toBe(5);
    expect(parsed.primary.config.chroma.taperLight).toBe(0.8);
    expect(parsed.neutral.anchors).toEqual(['#798680', '#1a0a53']);
    expect(parsed.neutral.tint).toBe('primary');
    expect(parsed.presetMode).toBe(false);
  });

  it('flags preset mode', () => {
    const json = buildConfigJson({
      presetMode: true,
      primary: { anchors: ['#a286fd'], config: defaultConfig() },
      neutral: { anchors: ['#798680'], config: defaultConfig(), tint: 'own' },
    });
    expect(JSON.parse(json).presetMode).toBe(true);
  });
});
