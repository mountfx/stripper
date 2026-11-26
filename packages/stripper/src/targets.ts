import { SCALE_STEPS, type ApcaTarget, type ApcaTargets, type ScaleStepNumber, type WcagTarget, type WcagTargets } from './types';

/**
 * The APCA contrast ladder — engine-owned and intentionally not configurable.
 *
 * Each shade is measured as TEXT against black (steps < 500) or white (steps >= 500)
 * so that every generated scale, regardless of brand hue, satisfies the same
 * contrast contract. This is the "consistent contrast" guarantee of the design
 * system; clients cannot weaken it. If contrast variants are ever needed, they
 * should be named modes (e.g. contrastProfile: 'default' | 'strict'), not editable tables.
 *
 * Polarity follows the APCA convention: dark text on light bg is positive,
 * light text on dark bg is negative.
 */
export const APCA_CONTRAST_TARGETS: ApcaTargets = {
  50: { lc: -103, bg: 'black' },
  100: { lc: -97, bg: 'black' },
  200: { lc: -88, bg: 'black' },
  300: { lc: -75, bg: 'black' },
  400: { lc: -60, bg: 'black' },
  500: { lc: 55, bg: 'white' },
  600: { lc: 67, bg: 'white' },
  700: { lc: 78, bg: 'white' },
  800: { lc: 86, bg: 'white' },
  900: { lc: 92, bg: 'white' },
  950: { lc: 101, bg: 'white' },
};

/** Target for a scale step, from the fixed ladder. */
export function targetFor(step: ScaleStepNumber): ApcaTarget {
  return APCA_CONTRAST_TARGETS[step];
}

/**
 * The WCAG 2.2 contrast ladder — the ratio analogue of the APCA ladder, same
 * engine-owned contract shape: steps < 500 are measured against black, steps
 * >= 500 against white. Ratios are symmetric (no polarity sign).
 */
export const WCAG_CONTRAST_TARGETS: WcagTargets = {
  50: { ratio: 19, bg: 'black' },
  100: { ratio: 15.5, bg: 'black' },
  200: { ratio: 12, bg: 'black' },
  300: { ratio: 9, bg: 'black' },
  400: { ratio: 6.5, bg: 'black' },
  500: { ratio: 4.5, bg: 'white' },
  600: { ratio: 6.5, bg: 'white' },
  700: { ratio: 9, bg: 'white' },
  800: { ratio: 12, bg: 'white' },
  900: { ratio: 15.5, bg: 'white' },
  950: { ratio: 19, bg: 'white' },
};

/** WCAG target for a scale step, from the fixed ladder. */
export function wcagTargetFor(step: ScaleStepNumber): WcagTarget {
  return WCAG_CONTRAST_TARGETS[step];
}

/** Hex of the ladder reference background for a step (black for < 500, white for >= 500). */
export function bgHexFor(step: ScaleStepNumber): string {
  return targetFor(step).bg === 'black' ? '#000000' : '#ffffff';
}

/** Zero-based index of a step in {@link SCALE_STEPS}; throws on an unknown step. */
export function stepIndex(step: ScaleStepNumber): number {
  const i = SCALE_STEPS.indexOf(step);
  if (i === -1) throw new Error(`Unknown scale step: ${step}`);
  return i;
}
