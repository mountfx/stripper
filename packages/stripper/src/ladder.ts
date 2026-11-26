/**
 * Contrast-ladder subsystem: the fixed per-step contracts (APCA Lc and WCAG 2.2
 * ratio), the lightness solver that enforces them, and the diagnostic boundary
 * helper. The ladders are engine-owned and intentionally not configurable.
 */
import { inSrgb, gamutClamp, stepToHex, oklchOfHex, hslOfHex } from './gamut';
import { parse, converter } from 'culori';
import { displayY, apcaLc } from './apca';
import { wcagLuminance } from './wcag';
import { targetFor, wcagTargetFor } from './targets';
import type { ContrastMode, ScaleConfig, ScaleStep, Oklch, ScaleStepNumber } from './types';

/** The lightness boundary where a contrast ladder is exactly met (see {@link ladderBoundaryL}). */
export interface LadderBoundary {
  /** lightness at which the ladder is exactly met (meaningful only when reachable) */
  l: number;
  /** false when the target cannot be met in sRGB for this hue/chroma */
  reachable: boolean;
}

/** Is a measured contrast value within the ladder tolerance of the target? */
export function withinTolerance(
  contrastMode: 'apca' | 'wcag',
  value: number,
  target: number,
  tolerance: number,
  darkHalf: boolean,
): boolean {
  if (contrastMode === 'apca') {
    // signed Lc: dark half targets are negative — allowed side is metric <= target + tol
    return darkHalf ? value <= target + tolerance : value >= target - tolerance;
  }
  // WCAG ratios are symmetric: allowed side is metric >= target - tol
  return value >= target - tolerance;
}

/** The per-mode plumbing behind {@link CONTRAST_MODES}: screen-luminance transfer curve, contrast metric, fixed per-step target/background, and generation tolerance. */
export interface ContrastModeDef {
  /** screen-luminance Y of sRGB channels (model-specific transfer curve) */
  yOf: (rgb: { r: number; g: number; b: number }) => number;
  /** contrast value from screen-luminance Y values (text Y, background Y) */
  metricY: (yText: number, yBackground: number) => number;
  /** the fixed ladder target for a step (signed Lc or ratio, per mode) */
  target: (step: ScaleStepNumber) => number;
  /** the reference background for a step ('black' below 500, 'white' at/above) */
  bg: (step: ScaleStepNumber) => 'black' | 'white';
  /** generation tolerance around the target (±2 Lc / ±0.1 ratio) */
  tolerance: number;
  /** metric label used in warnings ("Lc" / "ratio") */
  label: string;
}

/**
 * Per contrast-mode plumbing: the screen-luminance transfer curve, the contrast
 * metric, the fixed target/background per step, and the generation tolerance
 * (±2 Lc / ±0.1 ratio). Not configurable — the ladders are the system's contract.
 */
export const CONTRAST_MODES: Record<
  Exclude<ContrastMode, 'none'>,
  ContrastModeDef
> = {
  apca: {
    yOf: (rgb) => displayY(rgb.r, rgb.g, rgb.b),
    metricY: apcaLc,
    target: (step) => targetFor(step).lc,
    bg: (step) => targetFor(step).bg,
    tolerance: 2,
    label: 'Lc',
  },
  wcag: {
    yOf: (rgb) => wcagLuminance(rgb.r, rgb.g, rgb.b),
    metricY: (yText, yBackground) => {
      const lighter = Math.max(yText, yBackground);
      const darker = Math.min(yText, yBackground);
      return (lighter + 0.05) / (darker + 0.05);
    },
    target: (step) => wcagTargetFor(step).ratio,
    bg: (step) => wcagTargetFor(step).bg,
    tolerance: 0.1,
    label: 'ratio',
  },
};

const toRgb = converter('rgb');

function rgbOfOk(ok: Oklch): { r: number; g: number; b: number } {
  return toRgb({ mode: 'oklch', l: ok.l, c: ok.c, h: ok.h });
}

function rgbOfHex(hex: string): { r: number; g: number; b: number } {
  return toRgb(parse(hex)!);
}

/**
 * Solve the lightness of a hue/chroma pair so that the color used as TEXT
 * against `bg` hits the target under the mode's contrast metric. Coarse scan +
 * local refinement; candidates are gamut-clamped per lightness, so results are
 * always displayable. Operates on screen-luminance Y directly — no hex
 * round-trips in the hot loop.
 */
export function solveLightnessFor(
  hue: number,
  chroma: number,
  bgHex: string,
  step: ScaleStepNumber,
  contrastMode: 'apca' | 'wcag',
  toleranceOverride?: number,
): { l: number; achieved: number; approximated: boolean } {
  const def = CONTRAST_MODES[contrastMode as Exclude<ContrastMode, 'none'>];
  const bgY = def.yOf(rgbOfHex(bgHex));
  const target = def.target(step);
  const tolerance = toleranceOverride ?? def.tolerance;
  let bestL = 0.5;
  let bestDiff = Number.POSITIVE_INFINITY;
  const diffAt = (l: number): number => {
    const ok = gamutClamp({ l, c: chroma, h: hue });
    const yText = def.yOf(rgbOfOk(ok));
    return Math.abs(target - def.metricY(yText, bgY));
  };
  for (let l = 0; l <= 1.00001; l += 0.0025) {
    const diff = diffAt(l);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestL = l;
    }
  }
  for (let l = Math.max(0, bestL - 0.0025); l <= Math.min(1, bestL + 0.0025) + 1e-9; l += 0.00025) {
    const diff = diffAt(l);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestL = l;
    }
  }
  const finalOk = gamutClamp({ l: bestL, c: chroma, h: hue });
  const finalY = def.yOf(rgbOfOk(finalOk));
  const achieved = def.metricY(finalY, bgY);
  return { l: finalOk.l, achieved, approximated: bestDiff > tolerance };
}

/** Re-solve each step's lightness against the configured contrast ladder. */
export function applyContrastLadder(
  entries: Array<{ number: ScaleStepNumber; ok: Oklch; kept?: boolean; keptHex?: string }>,
  cfg: ScaleConfig,
  warnings: string[],
): ScaleStep[] {
  return entries.map(({ number, ok, kept, keptHex }) => {
    let final = ok;
    let approximated = false;
    let isKept = false;
    if (cfg.contrastMode !== 'none') {
      const mode = CONTRAST_MODES[cfg.contrastMode as Exclude<ContrastMode, 'none'>];
      const bgY = mode.yOf(rgbOfHex(mode.bg(number) === 'black' ? '#000000' : '#ffffff'));
      const targetValue = mode.target(number);
      const yText = mode.yOf(rgbOfOk(ok));
      if (kept) {
        // brand color kept byte-exact by request: skip the solve, surface the deviation
        const achieved = mode.metricY(yText, bgY);
        const deviation = Math.abs(Math.abs(achieved) - Math.abs(targetValue));
        if (deviation > mode.tolerance) {
          warnings.push(
            `Step ${number}: brand color kept exact (${mode.label} ${achieved.toFixed(1)} vs ladder target ${targetValue}).`,
          );
        }
        isKept = true;
      } else {
        const bgHex = mode.bg(number) === 'black' ? '#000000' : '#ffffff';
        const solved = solveLightnessFor(ok.h, ok.c, bgHex, number, cfg.contrastMode);
        final = gamutClamp({ l: solved.l, c: ok.c, h: ok.h });
        approximated = solved.approximated;
        if (approximated) {
          warnings.push(
            `Step ${number}: ${cfg.contrastMode.toUpperCase()} target ${targetValue} not reachable (closest ${mode.label} = ${solved.achieved.toFixed(1)}).`,
          );
        }
      }
    }
    // kept anchors emit the original hex directly — the oklch roundtrip can drift by +/-1
    const hex = isKept && keptHex ? keptHex : stepToHex(final);
    const oklch = isKept && keptHex ? oklchOfHex(hex) : final;
    const hsl = hslOfHex(hex);
    return {
      number,
      hex,
      oklch,
      hsl,
      approximated: approximated || undefined,
      kept: isKept || undefined,
    };
  });
}

/**
 * The lightness where the active contrast ladder starts being satisfied (within
 * its tolerance) for the color (l, c, h) at `step` — the edge of the "contract
 * channel".
 *
 * Semantics match the generator: a target counts as met within the mode
 * tolerance (±2 Lc / ±0.1 ratio). The boundary must exist at the GIVEN chroma
 * (candidates outside sRGB are skipped, never chroma-clamped) — a color whose
 * chroma cannot satisfy the contract at any displayable lightness is flagged
 * unreachable. Dark-half steps (measured vs black) become satisfiable as
 * lightness increases; light-half steps (vs white) as lightness decreases.
 * Note: vivid colors may enter the displayable range already satisfied — the
 * boundary is then the gamut edge itself.
 */
export function ladderBoundaryL(
  h: number,
  c: number,
  step: ScaleStepNumber,
  contrastMode: ContrastMode,
  /** override the mode tolerance for the boundary edge (0 = exact target) */
  toleranceOverride?: number,
): LadderBoundary {
  if (contrastMode === 'none') return { l: 0.5, reachable: false };
  const def = CONTRAST_MODES[contrastMode as Exclude<ContrastMode, 'none'>];
  const bgY = def.yOf(rgbOfHex(def.bg(step) === 'black' ? '#000000' : '#ffffff'));
  const target = def.target(step);
  const tolerance = toleranceOverride ?? def.tolerance;
  const darkHalf = (step as number) < 500;

  const satisfied = (l: number): boolean | null => {
    if (!inSrgb({ mode: 'oklch', l, c, h })) return null; // outside sRGB at this chroma
    const yText = def.yOf(rgbOfOk({ l, c, h }));
    return withinTolerance(contrastMode, def.metricY(yText, bgY), target, tolerance, darkHalf);
  };

  // scan in the direction where satisfaction becomes possible
  const stepDir = darkHalf ? 0.002 : -0.002;
  const from = darkHalf ? 0 : 1;
  let prevL = from;
  let prevState: boolean | null = satisfied(from);
  for (let i = 1; i <= 501; i++) {
    const l = from + stepDir * i;
    if (l < 0 || l > 1) break;
    const state = satisfied(l);
    if (state === null) {
      // displayable gap: crossing must lie within one run
      prevL = l + stepDir;
      prevState = null;
      continue;
    }
    if (prevState !== true && state === true) {
      // entering the satisfied region (from a violating sample or from
      // out-of-gamut): binary refine the exact edge
      let lo = prevL;
      let hi = l;
      for (let k = 0; k < 12; k++) {
        const mid = (lo + hi) / 2;
        if (satisfied(mid) === true) hi = mid;
        else lo = mid;
      }
      return { l: hi, reachable: true };
    }
    prevL = l;
    prevState = state;
  }
  return { l: 0.5, reachable: false };
}
