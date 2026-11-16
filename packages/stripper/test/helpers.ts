import { targetFor } from '../src/targets';
import { lc } from '../src/apca';
import { wcagRatio } from '../src/wcag';
import type { ScaleStepNumber } from '../src/types';

/** Hex of the reference background for a step's ladder rule (black for < 500, white for >= 500). */
export function bgHexFor(step: ScaleStepNumber): string {
  return targetFor(step).bg === 'black' ? '#000000' : '#ffffff';
}

/** APCA Lc of a step color as text against its ladder reference background. */
export function stepLc(hex: string, step: ScaleStepNumber): number {
  return lc(hex, bgHexFor(step));
}

/** WCAG ratio of a step color as text against its ladder reference background. */
export function stepRatio(hex: string, step: ScaleStepNumber): number {
  return wcagRatio(hex, bgHexFor(step));
}
