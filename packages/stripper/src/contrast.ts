import { lcBlackOn, lcWhiteOn } from './apca';
import type { Scale } from './types';

/** APCA Readability Criterion levels (bronze/simple guidance). */
export const APCA_LEVELS = [
  { min: 90, label: 'Preferred body' },
  { min: 75, label: 'Body text' },
  { min: 60, label: 'Content text' },
  { min: 45, label: 'Large text' },
  { min: 30, label: 'Headlines' },
  { min: 15, label: 'Spot / non-text' },
] as const;

/** Highest APCA level satisfied by the given Lc magnitude, or null below 15. */
export function apcaLevel(lcValue: number): (typeof APCA_LEVELS)[number]['min'] | null {
  const abs = Math.abs(lcValue);
  for (const level of APCA_LEVELS) {
    if (abs >= level.min) return level.min;
  }
  return null;
}

/**
 * UI-critical contrast sanity checks (informational, not hard failures):
 * - white text on 600 (primary button) should reach Lc 60
 * - black text on 100 (chips/badges on tinted surface) should reach Lc 60
 * - white text on 500 (filled controls) should reach Lc 45
 */
export function criticalPairWarnings(scale: Scale): string[] {
  const messages: string[] = [];
  const byStep = new Map<number, { hex: string }>(scale.steps.map((s) => [s.number, s]));
  const check = (step: number, txt: 'black' | 'white', minLc: number, label: string) => {
    const s = byStep.get(step);
    if (!s) return;
    const value = txt === 'black' ? lcBlackOn(s.hex) : lcWhiteOn(s.hex);
    if (Math.abs(value) < minLc) {
      messages.push(`${label}: |Lc| ${Math.abs(value).toFixed(0)} < ${minLc} (${txt} text on ${step})`);
    }
  };
  check(600, 'white', 60, 'White text on 600 (primary button)');
  check(500, 'white', 45, 'White text on 500 (filled controls)');
  check(100, 'black', 60, 'Black text on 100 (tinted surface)');
  return messages;
}
