/**
 * WCAG 2.2 contrast-ratio model (identical formula since WCAG 2.0).
 *
 * Relative luminance uses the piecewise sRGB linearization — note this is a
 * different transfer curve than the APCA model's pure 2.4-power Y. Ratio =
 * (Ylighter + 0.05) / (Ydarker + 0.05), range 1–21, symmetric (no polarity sign).
 */
import { parse, converter } from 'culori';

const toRgb = converter('rgb');

function linearizeChannel(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Relative luminance per the WCAG definition, from sRGB channels (0..1). */
export function wcagLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linearizeChannel(r) + 0.7152 * linearizeChannel(g) + 0.0722 * linearizeChannel(b);
}

/** Relative luminance for a CSS color string. Throws on unparseable input. */
export function wcagLuminanceOf(color: string): number {
  const c = parse(color);
  if (!c) throw new Error(`Unparseable color: ${color}`);
  const rgb = toRgb(c);
  return wcagLuminance(rgb.r, rgb.g, rgb.b);
}

/**
 * WCAG contrast ratio between text and background colors: 1 (equal) to 21
 * (black vs white). Symmetric — no direction/sign.
 */
export function wcagRatio(text: string, background: string): number {
  const yt = wcagLuminanceOf(text);
  const yb = wcagLuminanceOf(background);
  const lighter = Math.max(yt, yb);
  const darker = Math.min(yt, yb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Ratio of black text on `background`. */
export function ratioOnBlack(background: string): number {
  return (wcagLuminanceOf(background) + 0.05) / 0.05;
}

/** Ratio of white text on `background`. */
export function ratioOnWhite(background: string): number {
  return 1.05 / (wcagLuminanceOf(background) + 0.05);
}

/** WCAG contrast levels used for UI chips. */
export const WCAG_LEVELS = [
  { min: 7, label: 'AAA text' },
  { min: 4.5, label: 'AA text' },
  { min: 3, label: 'Large text / non-text' },
] as const;

/** Highest WCAG level satisfied by the ratio, or null below 3. */
export function wcagLevel(ratio: number): (typeof WCAG_LEVELS)[number]['min'] | null {
  for (const level of WCAG_LEVELS) {
    if (ratio >= level.min) return level.min;
  }
  return null;
}
