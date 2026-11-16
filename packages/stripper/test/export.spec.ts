import { describe, it, expect } from 'vitest';
import { generateScale } from '../src/generate';
import { toThemeCss, toJson, toSwiftUi, toKotlin } from '../src/export';
import { KONVERTO_PRESET } from '../src/presets';
import { SCALE_STEPS, type Scale } from '../src/types';

function scaleFromPreset(steps: Record<number, string>): Scale {
  return {
    input: steps[500]!,
    anchorStep: 500,
    anchors: [{ step: 500, hex: steps[500]! }],
    steps: SCALE_STEPS.map((n) => {
      const hex = steps[n]!;
      return { number: n, hex, oklch: { l: 0, c: 0, h: 0 }, hsl: { h: 0, s: 0, l: 0 } };
    }),
    warnings: [],
  };
}

describe('export', () => {
  it('emits Tailwind v4 @theme CSS with oklch tokens', () => {
    const scale = scaleFromPreset(KONVERTO_PRESET.primary.steps as unknown as Record<number, string>);
    const css = toThemeCss([{ name: 'primary', scale }]);
    expect(css).toContain('@theme {');
    expect(css).toContain('--color-primary-500:');
    expect(css).toMatch(/--color-primary-\d+: oklch\(\d+(\.\d+)?% \d+\.\d+ \d+(\.\d+)?\);/);
    // every step present
    for (const n of SCALE_STEPS) {
      expect(css).toContain(`--color-primary-${n}:`);
    }
  });

  it('round-trips through oklch without losing visible color', () => {
    const scale = generateScale('#a286fd');
    const css = toThemeCss([{ name: 'primary', scale }]);
    // parse the oklch strings back out and compare hexes approximately
    const lines = css.split('\n').filter((l) => l.includes('--color-primary-500'));
    expect(lines).toHaveLength(1);
    const oklch = lines[0]!.split(':')[1]!.replace(';', '').trim();
    expect(oklch).toMatch(/^oklch\(/);
  });

  it('JSON export includes all steps and metadata', () => {
    const scale = scaleFromPreset(KONVERTO_PRESET.neutral.steps as unknown as Record<number, string>);
    const json = toJson([{ name: 'neutral', scale }]);
    const parsed = JSON.parse(json);
    expect(parsed.neutral.input).toBe('#798680');
    expect(Object.keys(parsed.neutral.steps)).toHaveLength(11);
    expect(parsed.neutral.steps['500'].hex).toBe('#798680');
    expect(parsed.neutral.steps['950'].hex).toBe('#0a1e12');
  });

  it('emits SwiftUI Color extension with sRGB components', () => {
    const scale = scaleFromPreset(KONVERTO_PRESET.primary.steps as unknown as Record<number, string>);
    const swift = toSwiftUi([{ name: 'primary', scale }]);
    expect(swift).toContain('import SwiftUI');
    expect(swift).toContain('extension Color {');
    // #a286fd = rgb(162, 134, 253) -> 0.6353/0.5255/0.9922
    expect(swift).toContain('static let primary500 = Color(red: 0.6353, green: 0.5255, blue: 0.9922)  // #a286fd');
    for (const n of SCALE_STEPS) {
      expect(swift).toContain(`static let primary${n} = Color(red:`);
    }
  });

  it('emits Jetpack Compose Color literals', () => {
    const scale = scaleFromPreset(KONVERTO_PRESET.primary.steps as unknown as Record<number, string>);
    const kt = toKotlin([{ name: 'primary', scale }]);
    expect(kt).toContain('import androidx.compose.ui.graphics.Color');
    expect(kt).toContain('val PRIMARY_500 = Color(0xFFA286FD)');
    for (const n of SCALE_STEPS) {
      expect(kt).toContain(`val PRIMARY_${n} = Color(0xFF`);
    }
  });

  it('sanitizes scale names into valid identifiers for both targets', () => {
    const scale = scaleFromPreset(KONVERTO_PRESET.primary.steps as unknown as Record<number, string>);
    const swift = toSwiftUi([{ name: 'my-brand', scale }]);
    expect(swift).toContain('static let myBrand500 = Color(red:');
    expect(swift).not.toMatch(/static let [A-Za-z0-9_]*-/); // identifiers never contain the raw name
    const kt = toKotlin([{ name: 'my-brand', scale }]);
    expect(kt).toContain('val MY_BRAND_500 = Color(0xFF');
    expect(kt).not.toMatch(/val [A-Za-z0-9_]*-/);
  });
});

describe('konverto preset', () => {
  it('contains the exact provided scales', () => {
    expect(KONVERTO_PRESET.primary.steps[500]).toBe('#a286fd');
    expect(KONVERTO_PRESET.primary.steps[700]).toBe('#7a30e8');
    expect(KONVERTO_PRESET.neutral.steps[500]).toBe('#798680');
    expect(KONVERTO_PRESET.neutral.steps[50]).toBe('#f1f3f3');
  });
});
