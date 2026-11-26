/**
 * sRGB gamut utilities: clamping, hex conversion, chroma budgets.
 * Pure color math — no knowledge of scales, ladders, or config.
 */
import { formatHex, inGamut, parse, converter } from 'culori';
import type { ColorInput, Oklch } from './types';

const srgbTest = inGamut('rgb');

/** Whether a color (CSS string or `{ mode, ... }` color-space object) renders inside sRGB. */
export const inSrgb = (color: ColorInput): boolean => srgbTest(color as Parameters<typeof srgbTest>[0]);

const toOklch = converter('oklch');
const toHsl = converter('hsl');

export function clampHue(h: number): number {
  let out = h % 360;
  if (out < 0) out += 360;
  return out;
}

/**
 * Ensure the oklch color is inside sRGB by reducing chroma only —
 * L and H are preserved exactly (culori's clampChroma also shifts L/H,
 * which would break the APCA lightness solving).
 */
export function gamutClamp(ok: Oklch): Oklch {
  const test = (c: number) => inSrgb({ mode: 'oklch', l: ok.l, c, h: ok.h });
  if (test(ok.c)) return { l: ok.l, c: Math.max(ok.c, 0), h: ok.h };
  let lo = 0;
  let hi = ok.c;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (test(mid)) lo = mid;
    else hi = mid;
  }
  return { l: ok.l, c: lo, h: ok.h };
}

export function stepToHex(ok: Oklch): string {
  return formatHex({ mode: 'oklch', l: ok.l, c: ok.c, h: ok.h }) ?? '#000000';
}

/** OKLCH view of a hex color, with hue/chroma coalesced to zero when achromatic. */
export function oklchOfHex(hex: string): Oklch {
  const c = toOklch(parse(hex)!);
  return { l: c.l, c: c.c ?? 0, h: c.h ?? 0 };
}

/** HSL view of a hex color, with hue coalesced to zero when achromatic. */
export function hslOfHex(hex: string): { h: number; s: number; l: number } {
  const c = toHsl(parse(hex)!);
  return { h: c.h ?? 0, s: c.s ?? 0, l: c.l ?? 0 };
}

/** Largest chroma at lightness `l`, hue `h` that stays inside sRGB (0..~0.45). */
export function maxSrgbChroma(l: number, h: number): number {
  const test = (c: number) => inSrgb({ mode: 'oklch', l, c, h });
  if (!test(0)) return 0;
  let lo = 0;
  let hi = 0.45;
  if (test(hi)) return hi;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (test(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Shortest-arc hue interpolation around the color wheel. */
export function lerpHue(a: number, b: number, t: number): number {
  const delta = ((b - a + 540) % 360) - 180;
  return clampHue(a + delta * t);
}

/** Axis cells for the displayability scans (and the bisection refinements run per cell edge). */
const DISPLAYABILITY_CELLS = 32;

/**
 * Displayable lightness interval at a given chroma/hue — the range of `l` for
 * which oklch(l, c, h) exists in sRGB. Null when no lightness is displayable
 * at that chroma/hue. Grid scan with per-edge bisection refinement.
 */
export function displayableLightnessRange(c: number, h: number): { lo: number; hi: number } | null {
  const K = DISPLAYABILITY_CELLS;
  let first = -1;
  let last = -1;
  for (let k = 0; k <= K; k++) {
    const l = k / K;
    if (inSrgb({ mode: 'oklch', l, c, h })) {
      if (first === -1) first = l;
      last = l;
    }
  }
  if (first === -1) return null;
  const cell = 1 / K;
  let lo = first;
  let hi = last;
  if (first > 0) {
    let a = first - cell;
    let b = first;
    for (let k = 0; k < 8; k++) {
      const mid = (a + b) / 2;
      if (inSrgb({ mode: 'oklch', l: mid, c, h })) b = mid;
      else a = mid;
    }
    lo = b;
  }
  if (last < 1) {
    let a = last;
    let b = last + cell;
    for (let k = 0; k < 8; k++) {
      const mid = (a + b) / 2;
      if (inSrgb({ mode: 'oklch', l: mid, c, h })) a = mid;
      else b = mid;
    }
    hi = a;
  }
  return { lo, hi };
}

