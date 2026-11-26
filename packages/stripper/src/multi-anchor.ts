/**
 * Multi-anchor scale generation: the scale transitions between 2-4 brand
 * colors placed by lightness. Shared ramp-quality checks live here so both
 * generator paths import them without cycles.
 */
import { gamutClamp, oklchOfHex, hslOfHex, lerp, lerpHue } from './gamut';
import { applyContrastLadder } from './ladder';
import { resolveLadderAnchorStep } from './anchor-resolution';
import { CHROMATIC_PROFILE, GRAY_PROFILE } from './families';
import { toHex } from './locate';
import { SCALE_STEPS, type Oklch, type ScaleAnchor, type ScaleConfig, type Scale, type ScaleStep, type ScaleStepNumber } from './types';
import { stepIndex } from './targets';

/** Warn when the ramp is not light -> dark from step 50 to 950. */
export function checkLightnessMonotonicity(steps: ScaleStep[], warnings: string[]): void {
  for (let i = 1; i < steps.length; i++) {
    if (steps[i]!.oklch.l > steps[i - 1]!.oklch.l + 1e-6) {
      warnings.push(
        `Scale lightness is not monotone from step 50 to 950 (rises at step ${steps[i]!.number}); check anchor placement and brand colors.`,
      );
      return;
    }
  }
}

/**
 * Multi-anchor scale (2-4 brand colors): the scale transitions between them.
 *
 * Anchors resolve to steps by lightness (nearest profile step, conflicts
 * auto-placed on the nearest free step with warnings). Between adjacent
 * anchors, hue interpolates shortest-arc and chroma follows a per-anchor
 * scaling factor `k = anchor.c / profile.c[anchorStep]` blended over the
 * balanced profile — which reproduces each anchor color exactly at its step.
 * Carve-outs: no tailwindTransfer, no hue drift, no tint; chroma taper
 * applies only outside the outermost anchors.
 */
/** Hard cap on brand colors in one scale; extras are truncated with a warning. */
export const MAX_ANCHORS = 4;

export function generateMultiAnchorScale(anchorList: ScaleAnchor[], cfg: ScaleConfig, warnings: string[]): Scale {
  let anchors = anchorList.map((a) => ({ hex: toHex(a.hex), anchor: a.anchor }));
  if (anchors.length > MAX_ANCHORS) {
    warnings.push(`Multi-anchor scales support at most ${MAX_ANCHORS} brand colors; extra colors were dropped.`);
    anchors = anchors.slice(0, MAX_ANCHORS);
  }
  const colors: Array<{ hex: string; anchor?: ScaleStepNumber | 'auto'; ok: Oklch; hsl: { h: number; s: number; l: number }; step?: ScaleStepNumber }> = anchors.map((a) => ({
    ...a,
    ok: oklchOfHex(a.hex),
    hsl: hslOfHex(a.hex),
  }));

  if (cfg.hue.driftLight !== 0 || cfg.hue.driftDark !== 0) {
    warnings.push('Hue drift is ignored for multi-anchor scales.');
  }
  if (cfg.hue.tint !== undefined) {
    warnings.push('Hue tint is ignored for multi-anchor scales.');
  }

  // ---- skeleton profile: gray only when every anchor is grayish ---------------------
  const profile = colors.every((c) => c.hsl.s <= 0.15) ? GRAY_PROFILE : CHROMATIC_PROFILE;

  // ---- resolve anchor steps ----------------------------------------------------------
  const desiredStep = (c: (typeof colors)[number]): ScaleStepNumber => {
    if (typeof c.anchor === 'number') return c.anchor;
    if (cfg.contrastMode !== 'none') return resolveLadderAnchorStep(c.ok, cfg);
    return SCALE_STEPS.reduce((acc, s) =>
      Math.abs((profile.l[s] ?? 0.5) - c.ok.l) < Math.abs((profile.l[acc] ?? 0.5) - c.ok.l) ? s : acc,
    );
  };

  // lightness order defines the ramp order; ties keep given order
  const ordered = [...colors].sort((a, b) => a.ok.l - b.ok.l);
  const taken = new Set<number>();
  for (const c of ordered) {
    const desired = desiredStep(c);
    let step = desired;
    if (taken.has(step)) {
      let best: ScaleStepNumber = step;
      let bestDist = Number.POSITIVE_INFINITY;
      for (const s of SCALE_STEPS) {
        if (taken.has(s)) continue;
        const dist = Math.abs(stepIndex(s) - stepIndex(desired));
        // tie-break toward lighter steps to preserve lightness ordering
        if (dist < bestDist || (dist === bestDist && s < best)) {
          best = s;
          bestDist = dist;
        }
      }
      step = best;
    }
    taken.add(step);
    c.step = step;
    if (step !== desired) {
      warnings.push(`Anchor ${c.hex} desired step ${desired} unavailable; placed at step ${step}.`);
    }
  }

  // lightness-order sanity: anchors close in lightness may not match user intent
  for (let i = 1; i < ordered.length; i++) {
    if (Math.abs(ordered[i]!.ok.l - ordered[i - 1]!.ok.l) < 0.08) {
      warnings.push(
        `Anchors ${ordered[i - 1]!.hex} and ${ordered[i]!.hex} have similar lightness (${ordered[i - 1]!.ok.l.toFixed(2)} / ${ordered[i]!.ok.l.toFixed(2)}); their step placement may not match your intent.`,
      );
      break;
    }
  }

  const anchorsByStep = ordered
    .map((c) => ({
      step: c.step as ScaleStepNumber,
      hex: c.hex,
      ok: c.ok,
      k: c.ok.c / Math.max(profile.c[c.step!] ?? 0.02, 0.02),
    }))
    .sort((a, b) => stepIndex(a.step) - stepIndex(b.step));
  const firstIdx = stepIndex(anchorsByStep[0]!.step);
  const lastIdx = stepIndex(anchorsByStep[anchorsByStep.length - 1]!.step);

  // ---- per-step curve ------------------------------------------------------------------
  const shaped: Array<{ number: ScaleStepNumber; ok: Oklch }> = SCALE_STEPS.map((step) => {
    const i = stepIndex(step);
    let hue: number;
    let k: number;
    if (i <= firstIdx) {
      hue = anchorsByStep[0]!.ok.h;
      k = anchorsByStep[0]!.k;
    } else if (i >= lastIdx) {
      const last = anchorsByStep[anchorsByStep.length - 1]!;
      hue = last.ok.h;
      k = last.k;
    } else {
      // find surrounding anchors
      let a = anchorsByStep[0]!;
      let b = anchorsByStep[anchorsByStep.length - 1]!;
      for (let n = 0; n < anchorsByStep.length - 1; n++) {
        const lo = anchorsByStep[n]!;
        const hi = anchorsByStep[n + 1]!;
        if (i >= stepIndex(lo.step) && i <= stepIndex(hi.step)) {
          a = lo;
          b = hi;
          break;
        }
      }
      const t = (i - stepIndex(a.step)) / (stepIndex(b.step) - stepIndex(a.step));
      hue = lerpHue(a.ok.h, b.ok.h, t);
      k = lerp(a.k, b.k, t);
    }

    // taper outside the outermost anchors only
    let taper = 1;
    if (i < firstIdx && firstIdx > 0) taper = 1 + (cfg.chroma.taperLight - 1) * ((firstIdx - i) / firstIdx);
    else if (i > lastIdx) taper = 1 + (cfg.chroma.taperDark - 1) * ((i - lastIdx) / (SCALE_STEPS.length - 1 - lastIdx));

    const ok: Oklch = {
      l: profile.l[step] ?? 0.5,
      c: Math.max((profile.c[step] ?? 0) * k * taper, 0),
      h: hue,
    };

    // aesthetic mode: anchor steps pin the brand lightness exactly
    const anchorHere = anchorsByStep.find((a) => a.step === step);
    if (cfg.contrastMode === 'none' && anchorHere) {
      ok.l = anchorHere.ok.l;
      ok.c = anchorHere.ok.c;
      ok.h = anchorHere.ok.h;
    }

    return {
      number: step,
      ok: gamutClamp(ok),
      kept: (cfg.keepAnchorsExact === true && cfg.contrastMode !== 'none' && anchorHere !== undefined) || undefined,
      keptHex: (cfg.keepAnchorsExact === true && cfg.contrastMode !== 'none' && anchorHere !== undefined) ? anchorHere.hex : undefined,
    };
  });

  const steps = applyContrastLadder(shaped, cfg, warnings);
  checkLightnessMonotonicity(steps, warnings);

  return {
    input: colors[0]!.hex,
    anchorStep: colors[0]!.step as ScaleStepNumber,
    anchors: colors.map((c) => ({ step: c.step as ScaleStepNumber, hex: c.hex })),
    steps,
    warnings,
  };
}
