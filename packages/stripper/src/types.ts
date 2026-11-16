export const SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type ScaleStepNumber = (typeof SCALE_STEPS)[number];

export type BaseMode = 'tailwindTransfer' | 'balancedCurve';

/** Which consistency contract drives per-step lightness: none (aesthetic), APCA Lc ladder, or WCAG 2.2 ratio ladder. */
export type ContrastMode = 'none' | 'apca' | 'wcag';

/** A brand color placed in a scale. `anchor` fixes the step; 'auto' resolves by lightness. */
export interface ScaleAnchor {
  hex: string;
  anchor?: ScaleStepNumber | 'auto';
}

export interface WcagTarget {
  /** contrast ratio target (1..21), measured against `bg` */
  ratio: number;
  bg: 'black' | 'white';
}

export type WcagTargets = Record<ScaleStepNumber, WcagTarget>;

/** APCA Lc target for one scale step. `bg` is the background the shade is measured against as text. */
export interface ApcaTarget {
  /** -1..1 scale of Lc, signed per APCA convention (dark-on-light positive, light-on-dark negative) */
  lc: number;
  bg: 'black' | 'white';
}

export type ApcaTargets = Record<ScaleStepNumber, ApcaTarget>;

export interface HueConfig {
  /** fixed hue override for every step (e.g. tinted neutrals); applied before drift */
  tint?: number;
  /** hue drift at the lightest step (50), degrees relative to the anchor hue */
  driftLight: number;
  /** hue drift at the darkest step (950), degrees relative to the anchor hue */
  driftDark: number;
}

export interface ChromaConfig {
  /** chroma factor at the lightest step (1 = untapered, 0 = gray at 50) */
  taperLight: number;
  /** chroma factor at the darkest step (1 = untapered, 0 = gray at 950) */
  taperDark: number;
}

export interface ScaleConfig {
  baseMode: BaseMode;
  /** re-solve lightness per step against the fixed contrast ladder (APCA Lc or WCAG 2.2 ratio) */
  contrastMode: ContrastMode;
  /** keep the input brand colors byte-exact at their anchor steps; anchor steps may deviate from the ladder (warned) */
  keepAnchorsExact?: boolean;
  hue: HueConfig;
  chroma: ChromaConfig;
}

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export interface ScaleStep {
  number: ScaleStepNumber;
  hex: string;
  oklch: Oklch;
  hsl: Hsl;
  /** true if the ladder target could not be reached exactly (closest achievable used) */
  approximated?: boolean;
  /** true if this anchor step keeps the input color byte-exact (keepAnchorsExact + ladder mode) */
  kept?: boolean;
}

export interface Scale {
  input: string;
  anchorStep: ScaleStepNumber;
  /** every resolved anchor — the brand color(s) reproduced exactly at their steps (single-anchor scales have exactly one) */
  anchors: Array<{ step: ScaleStepNumber; hex: string }>;
  steps: ScaleStep[];
  /** closest Tailwind family used for the tailwindTransfer mode */
  closestFamily?: string;
  warnings: string[];
}

export type ThemeScales = Array<{ name: string; scale: Scale }>;
