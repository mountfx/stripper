import { describe, it, expect } from 'vitest';
import { generateScale } from '../src/generate';
import { toThemeCss, toColorsJson, toJson, toSwiftUi, toKotlin } from '../src/export';
import { familyById, scaleFromFamily } from '../src/families';
import { SCALE_STEPS } from '../src/types';

const primary = () => scaleFromFamily(familyById('violet')!);
const neutral = () => scaleFromFamily(familyById('zinc')!);

describe('export', () => {
  it('emits Tailwind v4 @theme CSS with oklch tokens', () => {
    const css = toThemeCss([{ name: 'primary', scale: primary() }]);
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

  it('emits minimal JSON with hex arrays per scale in step order', () => {
    const json = toColorsJson([
      { name: 'primary', scale: primary() },
      { name: 'neutral', scale: neutral() },
    ]);
    const parsed = JSON.parse(json);
    expect(Object.keys(parsed)).toEqual(['primary', 'neutral']);
    // the arrays are exactly the steps' hexes, in step order 50 -> 950
    expect(parsed.primary).toEqual(primary().steps.map((s) => s.hex));
    expect(parsed.neutral).toEqual(neutral().steps.map((s) => s.hex));
    for (const arr of [parsed.primary, parsed.neutral]) {
      expect(arr).toHaveLength(11);
      for (const hex of arr) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
    // first/last are the lightest/darkest steps
    expect(parsed.primary[0]).toBe('#f5f3ff'); // violet-50
    expect(parsed.primary.at(-1)).toBe('#2e1065'); // violet-950
  });

  it('JSON export includes all steps and metadata', () => {
    const json = toJson([{ name: 'neutral', scale: neutral() }]);
    const parsed = JSON.parse(json);
    expect(parsed.neutral.input).toBe('#71717a');
    expect(Object.keys(parsed.neutral.steps)).toHaveLength(11);
    expect(parsed.neutral.steps['500'].hex).toBe('#71717a');
    expect(parsed.neutral.steps['950'].hex).toBe('#09090b');
  });

  it('emits SwiftUI Color extension with sRGB components', () => {
    const swift = toSwiftUi([{ name: 'primary', scale: primary() }]);
    expect(swift).toContain('import SwiftUI');
    expect(swift).toContain('extension Color {');
    // violet-500 #8b5cf6 = rgb(139, 92, 246) -> 0.5451/0.3608/0.9647
    expect(swift).toContain('static let primary500 = Color(red: 0.5451, green: 0.3608, blue: 0.9647)  // #8b5cf6');
    for (const n of SCALE_STEPS) {
      expect(swift).toContain(`static let primary${n} = Color(red:`);
    }
  });

  it('emits Jetpack Compose Color literals', () => {
    const kt = toKotlin([{ name: 'primary', scale: primary() }]);
    expect(kt).toContain('import androidx.compose.ui.graphics.Color');
    expect(kt).toContain('val PRIMARY_500 = Color(0xFF8B5CF6)');
    for (const n of SCALE_STEPS) {
      expect(kt).toContain(`val PRIMARY_${n} = Color(0xFF`);
    }
  });

  it('sanitizes scale names into valid identifiers for both targets', () => {
    const swift = toSwiftUi([{ name: 'my-brand', scale: primary() }]);
    expect(swift).toContain('static let myBrand500 = Color(red:');
    expect(swift).not.toMatch(/static let [A-Za-z0-9_]*-/); // identifiers never contain the raw name
    const kt = toKotlin([{ name: 'my-brand', scale: primary() }]);
    expect(kt).toContain('val MY_BRAND_500 = Color(0xFF');
    expect(kt).not.toMatch(/val [A-Za-z0-9_]*-/);
  });
});
