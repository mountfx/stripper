/**
 * Anchor resolution: which scale step a brand color naturally belongs to.
 */
import { CHROMATIC_PROFILE } from './families';
import { CONTRAST_MODES, solveLightnessFor } from './ladder';
import { SCALE_STEPS, type Oklch, type ScaleConfig, type ScaleStepNumber } from './types';

type LadderContrastMode = Exclude<ScaleConfig['contrastMode'], 'none'>;

/**
 * Ladder-aware anchor resolution: when a contrast ladder owns the lightness,
 * the natural step for a color is the one where the ladder demands the least
 * lightness distortion. For each candidate step the actual ladder target is
 * solved for the input's hue/chroma; the step whose solved lightness is closest
 * to the input's own lightness wins. Unreachable targets produce large
 * distortion, steering placement to feasible neighbors.
 *
 * In `none` mode there is no ladder: falls back to the profile-lightness rule.
 */
export function resolveLadderAnchorStep(inputOklch: Oklch, cfg: ScaleConfig): ScaleStepNumber {
  if (cfg.contrastMode === 'none') {
    // no ladder: fall back to the profile-lightness rule
    return SCALE_STEPS.reduce((acc, s) =>
      Math.abs((CHROMATIC_PROFILE.l[s] ?? 0.5) - inputOklch.l) < Math.abs((CHROMATIC_PROFILE.l[acc] ?? 0.5) - inputOklch.l) ? s : acc,
    );
  }
  const mode = CONTRAST_MODES[cfg.contrastMode as LadderContrastMode];
  let best: ScaleStepNumber = 500;
  let bestDistortion = Number.POSITIVE_INFINITY;
  for (const step of SCALE_STEPS) {
    const bgHex = mode.bg(step) === 'black' ? '#000000' : '#ffffff';
    const solved = solveLightnessFor(inputOklch.h, inputOklch.c, bgHex, step, cfg.contrastMode);
    const distortion = Math.abs(solved.l - inputOklch.l);
    // tie-break toward the lighter step for determinism
    if (distortion < bestDistortion || (distortion === bestDistortion && step < best)) {
      best = step;
      bestDistortion = distortion;
    }
  }
  return best;
}
