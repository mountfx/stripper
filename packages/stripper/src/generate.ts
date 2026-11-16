import { formatHex } from 'culori';
import { clampHue, gamutClamp, oklchOfHex, hslOfHex } from './gamut';
import {
  SCALE_STEPS,
  type ScaleAnchor,
  type ScaleConfig,
  type Scale,
  type ScaleStepNumber,
  type Oklch,
} from './types';
import { CHROMATIC_PROFILE, GRAY_PROFILE, GRAY_FAMILY_NAMES, TAILWIND_FAMILIES, type ColorFamily } from './families';
import { pickClosestFamily, toHex } from './locate';
import { stepIndex } from './targets';
import { applyContrastLadder } from './ladder';
import { generateMultiAnchorScale, checkLightnessMonotonicity } from './multi-anchor';
import { resolveLadderAnchorStep } from './anchor-resolution';

/** Tailwind-transfer base curve: family L/S curves transferred to the input hue (uicolors parity). */
function tailwindTransferBase(
  step: ScaleStepNumber,
  familyName: string,
  anchorStep: ScaleStepNumber,
  inHsl: { h: number; s: number; l: number },
  inOklch: Oklch,
  useGray: boolean,
): { number: ScaleStepNumber; ok: Oklch } {
  const fam: ColorFamily = (
    useGray
      ? TAILWIND_FAMILIES.filter((f) => GRAY_FAMILY_NAMES.has(f.name))
      : TAILWIND_FAMILIES.filter((f) => !GRAY_FAMILY_NAMES.has(f.name))
  ).find((f) => f.name === familyName)!;
  const shade = fam.shades.find((s) => s.number === step)!;
  const anchorShade = fam.shades.find((s) => s.number === anchorStep)!;
  const shadeHsl = hslOfHex(shade.hex);
  const anchorHsl = hslOfHex(anchorShade.hex);
  // uicolors parity: hue offset + saturation ratio transfer in HSL space
  const hueOffset = inHsl.h - anchorHsl.h;
  const satRatio = anchorHsl.s > 0 ? inHsl.s / anchorHsl.s : inHsl.s > 0 ? 1 : 0;
  const hex =
    formatHex({
      mode: 'hsl',
      h: clampHue(shadeHsl.h + hueOffset),
      s: shadeHsl.s * satRatio,
      l: shadeHsl.l,
    }) ?? shade.hex;
  const ok = oklchOfHex(hex);
  if (useGray) {
    // Pure-gray Tailwind families carry no chroma, which would erase the input's
    // subtle tint (e.g. holly's green-gray). Re-seed chroma/hue from the input,
    // shaped by the gray-family chroma curve so tints stay subtle and grow
    // naturally toward the dark end.
    const anchorC = Math.max(GRAY_PROFILE.c[anchorStep] ?? 0.02, 0.001);
    return {
      number: step,
      ok: {
        l: ok.l,
        c: inOklch.c * ((GRAY_PROFILE.c[step] ?? 0) / anchorC),
        h: inOklch.h,
      },
    };
  }
  return { number: step, ok };
}

/** Chroma taper factor: 1 at the anchor, `taper` at the scale extreme, linear between. */
function taperFactor(
  step: ScaleStepNumber,
  anchorIndex: number,
  taperLight: number,
  taperDark: number,
): number {
  const i = stepIndex(step);
  if (i < anchorIndex) {
    const d = anchorIndex === 0 ? 0 : (anchorIndex - i) / anchorIndex;
    return 1 + (taperLight - 1) * d;
  }
  if (i > anchorIndex) {
    const d = (i - anchorIndex) / (SCALE_STEPS.length - 1 - anchorIndex);
    return 1 + (taperDark - 1) * d;
  }
  return 1;
}

export function defaultConfig(): ScaleConfig {
  return {
    baseMode: 'tailwindTransfer',
    contrastMode: 'apca',
    hue: { driftLight: 0, driftDark: 0 },
    chroma: { taperLight: 1, taperDark: 1 },
  };
}

/**
 * Generate an 11-step (50-950) scale from one or more brand colors.
 *
 * Single color: anchored automatically at the step whose lightness it naturally
 * belongs to; every option derives from that anchor — the brand color stays the
 * coherent origin of the scale. Pipeline: base curve (tailwindTransfer |
 * balancedCurve) -> hue shaping (tint + drift) -> chroma tapering -> sRGB gamut
 * clamp -> optional consistent-contrast lightness re-solve (APCA Lc ladder or
 * WCAG 2.2 ratio ladder, per config) -> pin input at the anchor step.
 *
 * Multiple colors (2-4, "multi-anchor"): the scale transitions between them.
 * Anchors are resolved to steps by lightness — under a contrast ladder by
 * minimal ladder distortion (the step whose solved lightness is closest to the
 * color's own), otherwise by the base curve's lightness. Conflicts are
 * auto-placed with warnings. Hue interpolates shortest-arc between adjacent
 * anchors and chroma follows a per-anchor scaling factor over the balanced
 * profile — anchor colors are reproduced exactly at their steps. Multi-anchor
 * scales always use the balanced skeleton: tailwindTransfer, hue drift/offset
 * and hue tint do not apply.
 */
export function generateScale(input: string | Array<string | ScaleAnchor>, config?: ScaleConfig): Scale {
  const cfg = config ?? defaultConfig();
  const warnings: string[] = [];
  const anchorList: ScaleAnchor[] = (typeof input === 'string' ? [input] : input).map((a) =>
    typeof a === 'string' ? { hex: a } : a,
  );
  if (anchorList.length === 0) {
    throw new Error('At least one brand color is required');
  }

  if (anchorList.length > 1) {
    return generateMultiAnchorScale(anchorList, cfg, warnings);
  }
  const first = anchorList[0]!;
  const forcedAnchor = typeof first.anchor === 'number' ? first.anchor : undefined;
  const inputHex = toHex(first.hex);
  const inOklch = oklchOfHex(inputHex);
  const inHsl = hslOfHex(inputHex);

  // ---- 1. anchor step + family ------------------------------------------------
  let closestFamily: string | undefined;
  let anchorStep: ScaleStepNumber;

  if (cfg.baseMode === 'tailwindTransfer') {
    const located = pickClosestFamily(inputHex);
    closestFamily = located.family.name;
    anchorStep = located.anchorStep;
  } else {
    const useGray = inHsl.s <= 0.15;
    const prof = useGray ? GRAY_PROFILE : CHROMATIC_PROFILE;
    anchorStep = SCALE_STEPS.reduce((acc, s) =>
      Math.abs((prof.l[s] ?? 0.5) - inOklch.l) < Math.abs((prof.l[acc] ?? 0.5) - inOklch.l) ? s : acc,
    );
  }

  // ladder modes: the ladder owns lightness — place the anchor where the
  // contract demands the least distortion from the input color
  if (forcedAnchor === undefined && cfg.contrastMode !== 'none') {
    anchorStep = resolveLadderAnchorStep(inOklch, { ...cfg, contrastMode: cfg.contrastMode });
  }

  if (forcedAnchor !== undefined) {
    anchorStep = forcedAnchor;
  }

  const anchorIndex = stepIndex(anchorStep);

  // ---- 2. base curve per step ---------------------------------------------------
  const useGray = inHsl.s <= 0.15;
  const profile = useGray ? GRAY_PROFILE : CHROMATIC_PROFILE;
  const base: Array<{ number: ScaleStepNumber; ok: Oklch }> = SCALE_STEPS.map((step) => {
    if (cfg.baseMode === 'tailwindTransfer') {
      return tailwindTransferBase(step, closestFamily!, anchorStep, inHsl, inOklch, useGray);
    }
    // balancedCurve: averaged family profile with the input hue
    const anchorC = Math.max(profile.c[anchorStep] ?? 0.02, 0.02);
    return {
      number: step,
      ok: {
        l: profile.l[step] ?? inOklch.l,
        c: inOklch.c * ((profile.c[step] ?? 0) / anchorC),
        h: inOklch.h,
      },
    };
  });

  // ---- 3. fixed-hue tint override ---------------------------------------------------
  const tint = cfg.hue.tint ?? null;

  // ---- 4. hue + chroma shaping ------------------------------------------------------
  const shaped = base.map(({ number, ok }) => {
    const baseHue = tint !== null ? tint : ok.h;
    const i = stepIndex(number);
    const wLight = i < anchorIndex && anchorIndex > 0 ? (anchorIndex - i) / anchorIndex : 0;
    const wDark = i > anchorIndex ? (i - anchorIndex) / (SCALE_STEPS.length - 1 - anchorIndex) : 0;
    const h = clampHue(baseHue + cfg.hue.driftLight * wLight + cfg.hue.driftDark * wDark);

    const c = ok.c * taperFactor(number, anchorIndex, cfg.chroma.taperLight, cfg.chroma.taperDark);

    return { number, ok: gamutClamp({ l: ok.l, c: Math.max(c, 0), h }) };
  });

  // ---- 5. pin the input at the anchor step -------------------------------------------
  const keepExact = cfg.keepAnchorsExact === true && cfg.contrastMode !== 'none';
  const pinned = shaped.map(({ number, ok }) => {
    if (number !== anchorStep) return { number, ok };
    const pinHue = tint !== null ? clampHue(tint) : inOklch.h;
    if (keepExact) {
      // brand color kept byte-exact; the ladder solves every other step
      return { number, ok: gamutClamp({ l: inOklch.l, c: inOklch.c, h: inOklch.h }), kept: true, keptHex: inputHex };
    }
    if (cfg.contrastMode !== 'none') {
      // lightness gets re-solved below; carry input hue & chroma only
      return { number, ok: gamutClamp({ l: ok.l, c: inOklch.c, h: pinHue }) };
    }
    return { number, ok: { l: inOklch.l, c: inOklch.c, h: pinHue } };
  });

  // ---- 6. consistent-contrast post-process (APCA Lc ladder | WCAG 2.2 ratio ladder) ----
  const steps = applyContrastLadder(pinned, cfg, warnings);
  checkLightnessMonotonicity(steps, warnings);

  return {
    input: inputHex,
    anchorStep,
    anchors: [{ step: anchorStep, hex: inputHex }],
    steps,
    closestFamily,
    warnings,
  };
}

