import type { Scale, ThemeScales } from './types';

function fmt(value: number, digits: number): string {
  return value.toFixed(digits);
}

/** oklch(69.8% 0.170 292.2) — Tailwind v4 @theme style. */
export function oklchString(step: Scale['steps'][number]): string {
  const { l, c, h } = step.oklch;
  return `oklch(${fmt(l * 100, 1)}% ${fmt(c, 3)} ${fmt(h, 1)})`;
}

/**
 * Tailwind v4 theme CSS for the given scales.
 *
 * @theme {
 *   --color-primary-500: oklch(...);
 * }
 */
export function toThemeCss(scales: ThemeScales): string {
  const lines: string[] = ['@theme {'];
  for (const { name, scale } of scales) {
    for (const step of scale.steps) {
      lines.push(`  --color-${name}-${step.number}: ${oklchString(step)};`);
    }
  }
  lines.push('}');
  return lines.join('\n') + '\n';
}

/** JSON token export incl. hex, oklch, hsl per step. */
export function toJson(scales: ThemeScales): string {
  const out: Record<string, Record<string, unknown>> = {};
  for (const { name, scale } of scales) {
    const steps: Record<string, unknown> = {};
    for (const step of scale.steps) {
      steps[String(step.number)] = {
        hex: step.hex,
        oklch: oklchString(step),
        hsl: `hsl(${Math.round(((step.hsl.h % 360) + 360) % 360)} ${Math.round(step.hsl.s * 100)}% ${Math.round(step.hsl.l * 100)}%)`,
      };
    }
    out[name] = {
      input: scale.input,
      anchorStep: scale.anchorStep,
      closestFamily: scale.closestFamily ?? null,
      steps,
    };
  }
  return JSON.stringify(out, null, 2) + '\n';
}

/** Minimal JSON export: just the colors, per scale, as hex arrays in step order. */
export function toColorsJson(scales: ThemeScales): string {
  const out: Record<string, string[]> = {};
  for (const { name, scale } of scales) {
    out[name] = scale.steps.map((step) => step.hex);
  }
  return JSON.stringify(out, null, 2) + '\n';
}

// ---- native color tokens (SwiftUI / Jetpack Compose) ---------------------------------------

function hexParts(hex: string): { rgb01: [number, number, number]; argb: string } {
  const n = parseInt(hex.slice(1), 16);
  return {
    rgb01: [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255],
    argb: `0xFF${hex.slice(1).toUpperCase()}`,
  };
}

/** camelCase identifier ("my-brand" -> "myBrand"); digit-leading names get a "_" prefix. */
function swiftIdentifier(name: string): string {
  const parts = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (parts.length === 0) return '_scale';
  const id = parts[0]!.toLowerCase() + parts.slice(1).map((p) => p[0]!.toUpperCase() + p.slice(1).toLowerCase()).join('');
  return /^[0-9]/.test(id) ? '_' + id : id;
}

/** SCREAMING_SNAKE identifier ("my-brand" -> "MY_BRAND"); digit-leading names get a "_" prefix. */
function kotlinIdentifier(name: string): string {
  const id = name.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  return /^[0-9]/.test(id) ? '_' + id : id;
}

function scaleComment(name: string, scale: ThemeScales[number]['scale']): string {
  const meta = [scale.closestFamily ? `family: ${scale.closestFamily}` : null, `anchor: ${scale.anchorStep}`]
    .filter(Boolean)
    .join(' · ');
  return `// ${name}${meta ? ' · ' + meta : ''}`;
}

/**
 * SwiftUI color tokens: a `Color` extension per scale, sRGB components.
 *
 * extension Color {
 *     static let primary500 = Color(red: 0.9804, green: 0.2235, blue: 0.9804)  // #fa39fa
 * }
 */
export function toSwiftUi(scales: ThemeScales): string {
  const out: string[] = ['import SwiftUI', ''];
  for (const { name, scale } of scales) {
    out.push(scaleComment(name, scale));
    out.push('extension Color {');
    for (const step of scale.steps) {
      const [r, g, b] = hexParts(step.hex).rgb01;
      out.push(`    static let ${swiftIdentifier(name)}${step.number} = Color(red: ${fmt(r, 4)}, green: ${fmt(g, 4)}, blue: ${fmt(b, 4)})  // ${step.hex}`);
    }
    out.push('}');
    out.push('');
  }
  return out.join('\n').replace(/\n$/, '') + '\n';
}

/**
 * Jetpack Compose color tokens: top-level constants with ARGB literals.
 *
 * val PRIMARY_500 = Color(0xFFFA39FA)
 */
export function toKotlin(scales: ThemeScales): string {
  const out: string[] = ['import androidx.compose.ui.graphics.Color', ''];
  for (const { name, scale } of scales) {
    out.push(scaleComment(name, scale));
    for (const step of scale.steps) {
      out.push(`val ${kotlinIdentifier(name)}_${step.number} = Color(${hexParts(step.hex).argb})`);
    }
    out.push('');
  }
  return out.join('\n').replace(/\n$/, '') + '\n';
}
