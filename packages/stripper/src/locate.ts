import { parse, converter } from 'culori';
import { GRAY_FAMILY_NAMES, TAILWIND_FAMILIES } from './families';
import type { ColorFamily } from './families';
import type { ScaleStepNumber } from './types';

const toHsl = converter('hsl');
const toLab = converter('lab');
const toRgb = converter('rgb');

/** The Tailwind family an input color belongs to, plus its anchor step. */
export interface LocatedScale {
  /** the closest {@link ColorFamily} */
  family: ColorFamily;
  /** step whose lightness is closest to the input lightness */
  anchorStep: ScaleStepNumber;
}

/** Lab cache for family shades (the family data is immutable). */
const shadeLabCache = new Map<string, { l: number; a: number; b: number }>();

function labOfHex(hex: string): { l: number; a: number; b: number } {
  let lab = shadeLabCache.get(hex);
  if (!lab) {
    lab = toLab(parse(hex)!)!;
    shadeLabCache.set(hex, lab);
  }
  return lab;
}

/**
 * uicolors-style family selection:
 * - input with HSL saturation > 0.15 compares against chromatic families only,
 *   otherwise only gray families (Slate/Gray/Zinc/Neutral/Stone).
 * - the family whose single closest shade (CIE76 Lab distance) is nearest wins.
 */
export function pickClosestFamily(inputHex: string): LocatedScale {
  const hsl = toHsl(parse(inputHex))!;
  const grayish = (hsl.s ?? 0) <= 0.15;
  const candidates = TAILWIND_FAMILIES.filter((f) =>
    grayish ? GRAY_FAMILY_NAMES.has(f.name) : !GRAY_FAMILY_NAMES.has(f.name),
  );

  const inputLab = toLab(parse(inputHex)!)!;
  let bestFamily: ColorFamily = candidates[0]!;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const fam of candidates) {
    for (const shade of fam.shades) {
      const shadeLab = labOfHex(shade.hex);
      const d = (inputLab.l - shadeLab.l) ** 2 + (inputLab.a - shadeLab.a) ** 2 + (inputLab.b - shadeLab.b) ** 2;
      if (d < bestDist) {
        bestDist = d;
        bestFamily = fam;
      }
    }
  }

  const l0 = hsl.l ?? 0.5;
  const anchorShade = bestFamily.shades.reduce((acc, s) => {
    const lAcc = toHsl(parse(acc.hex)!)!.l ?? 0.5;
    const lS = toHsl(parse(s.hex)!)!.l ?? 0.5;
    return Math.abs(lS - l0) < Math.abs(lAcc - l0) ? s : acc;
  });

  return { family: bestFamily, anchorStep: anchorShade.number as ScaleStepNumber };
}

/** Normalize any parseable CSS color to #rrggbb. */
export function toHex(color: string): string {
  const c = parse(color);
  if (!c) throw new Error(`Unparseable color: ${color}`);
  const rgb = toRgb(c);
  const r = Math.round(rgb.r * 255);
  const g = Math.round(rgb.g * 255);
  const b = Math.round(rgb.b * 255);
  return '#' + [r, g, b].map((v) => Math.min(255, Math.max(0, v)).toString(16).padStart(2, '0')).join('');
}
