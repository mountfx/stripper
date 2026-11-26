/** The 11 scale steps, in Tailwind order (50–950). */
export const SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
/** One of the 11 scale steps. */
export type ScaleStepNumber = (typeof SCALE_STEPS)[number];

/** Base curve for step generation: transferred Tailwind family curves or the engine's balanced curve. */
export type BaseMode = 'tailwindTransfer' | 'balancedCurve';

/** Which consistency contract drives per-step lightness: none (aesthetic), APCA Lc ladder, or WCAG 2.2 ratio ladder. */
export type ContrastMode = 'none' | 'apca' | 'wcag';

/** A brand color placed in a scale. `anchor` fixes the step; 'auto' resolves by lightness. */
export interface ScaleAnchor {
  /** The brand color (hex). */
  hex: string;
  /** The step the color is placed at; 'auto' resolves by lightness. */
  anchor?: ScaleStepNumber | 'auto';
}

/** WCAG 2.2 contrast target for one scale step. */
export interface WcagTarget {
  /** contrast ratio target (1..21), measured against `bg` */
  ratio: number;
  /** the background the ratio is measured against */
  bg: 'black' | 'white';
}

/** WCAG 2.2 ratio targets per scale step ({@link WCAG_CONTRAST_TARGETS}). */
export type WcagTargets = Record<ScaleStepNumber, WcagTarget>;

/** APCA Lc target for one scale step. `bg` is the background the shade is measured against as text. */
export interface ApcaTarget {
  /** -1..1 scale of Lc, signed per APCA convention (dark-on-light positive, light-on-dark negative) */
  lc: number;
  /** the background the shade is measured against as text */
  bg: 'black' | 'white';
}

/** APCA Lc targets per scale step ({@link APCA_CONTRAST_TARGETS}). */
export type ApcaTargets = Record<ScaleStepNumber, ApcaTarget>;

/** Hue shaping: fixed tint plus linear drift from the anchor (zero at the anchor). */
export interface HueConfig {
  /** fixed hue override for every step (e.g. tinted neutrals); applied before drift */
  tint?: number;
  /** hue drift at the lightest step (50), degrees relative to the anchor hue */
  driftLight: number;
  /** hue drift at the darkest step (950), degrees relative to the anchor hue */
  driftDark: number;
}

/** Chroma shaping: taper factors toward the scale extremes (1 at the anchor). */
export interface ChromaConfig {
  /** chroma factor at the lightest step (1 = untapered, 0 = gray at 50) */
  taperLight: number;
  /** chroma factor at the darkest step (1 = untapered, 0 = gray at 950) */
  taperDark: number;
}

/** Configuration for {@link generateScale}. Defaults from {@link defaultConfig}. */
export interface ScaleConfig {
  /** the base curve used for per-step lightness/chroma before shaping */
  baseMode: BaseMode;
  /** re-solve lightness per step against the fixed contrast ladder (APCA Lc or WCAG 2.2 ratio) */
  contrastMode: ContrastMode;
  /** keep the input brand colors byte-exact at their anchor steps; anchor steps may deviate from the ladder (warned) */
  keepAnchorsExact?: boolean;
  /** hue shaping (tint + drift) */
  hue: HueConfig;
  /** chroma shaping (taper) */
  chroma: ChromaConfig;
}

/** OKLCH color components. */
export interface Oklch {
  /** lightness, 0..1 */
  l: number;
  /** chroma */
  c: number;
  /** hue in degrees, 0..360 */
  h: number;
}

/**
 * A color accepted by the inspection utilities: a CSS color string, or a
 * color-space object like `{ mode: 'oklch', l, c, h }`.
 */
export type ColorInput = string | { mode: string; [key: string]: unknown };

/** HSL color components. */
export interface Hsl {
  /** hue in degrees, 0..360 */
  h: number;
  /** saturation, 0..1 */
  s: number;
  /** lightness, 0..1 */
  l: number;
}

/** One generated step of a {@link Scale}. */
export interface ScaleStep {
  /** the step number (50–950) */
  number: ScaleStepNumber;
  /** #rrggbb, always inside sRGB */
  hex: string;
  /** OKLCH view of the step color */
  oklch: Oklch;
  /** HSL view of the step color */
  hsl: Hsl;
  /** true if the ladder target could not be reached exactly (closest achievable used) */
  approximated?: boolean;
  /** true if this anchor step keeps the input color byte-exact (keepAnchorsExact + ladder mode) */
  kept?: boolean;
}

/** A generated 11-step scale — the result of {@link generateScale}. */
export interface Scale {
  /** first anchor, normalized to #rrggbb */
  input: string;
  /** first anchor's resolved step */
  anchorStep: ScaleStepNumber;
  /** every resolved anchor — the brand color(s) reproduced exactly at their steps (single-anchor scales have exactly one) */
  anchors: Array<{ step: ScaleStepNumber; hex: string }>;
  /** the 11 steps, in step order (50–950) */
  steps: ScaleStep[];
  /** closest Tailwind family used for the tailwindTransfer mode */
  closestFamily?: string;
  /** conflicts, unreachable targets, carve-out notices */
  warnings: string[];
}

/** Named scales, as consumed by the export helpers. */
export type ThemeScales = Array<{ name: string; scale: Scale }>;
