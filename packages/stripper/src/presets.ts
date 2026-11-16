/**
 * Konverto Lab default brand scales, exactly as provided.
 * These ship untouched as the default theme; the generator serves new brand colors.
 */
import { parse, converter } from 'culori';
import { SCALE_STEPS, type Scale, type ScaleStepNumber } from './types';
export const KONVERTO_PRIMARY = {
  50: '#f5f7ff',
  100: '#ebecff',
  200: '#dbdcff',
  300: '#c9c7ff',
  400: '#baadff',
  500: '#a286fd',
  600: '#895af6',
  700: '#7a30e8',
  800: '#6b24c6',
  900: '#5b258e',
  950: '#40205a',
} as const;

export const KONVERTO_NEUTRAL = {
  50: '#f1f3f3',
  100: '#e6eae9',
  200: '#d6dbd9',
  300: '#bbc3c0',
  400: '#99a39f',
  500: '#798680',
  600: '#5c6661',
  700: '#3d4842',
  800: '#222f28',
  900: '#13251a',
  950: '#0a1e12',
} as const;

export const KONVERTO_PRESET = {
  name: 'Konverto Lab',
  primary: { input: KONVERTO_PRIMARY[500], steps: KONVERTO_PRIMARY },
  neutral: { input: KONVERTO_NEUTRAL[500], steps: KONVERTO_NEUTRAL },
}

type PresetSteps = Record<ScaleStepNumber, string>;

/** Build a proper {@link Scale} from a preset step table (e.g. KONVERTO_PRESET.primary.steps). */
export function scaleFromPreset(steps: PresetSteps): Scale {
  const toOklch = converter('oklch');
  const toHsl = converter('hsl');
  return {
    input: steps[500],
    anchorStep: 500,
    anchors: [{ step: 500, hex: steps[500] }],
    warnings: [],
    steps: SCALE_STEPS.map((n) => {
      const hex = steps[n]!;
      const ok = toOklch(parse(hex)!);
      const hsl = toHsl(parse(hex)!);
      return {
        number: n,
        hex,
        oklch: { l: ok.l, c: ok.c ?? 0, h: ok.h ?? 0 },
        hsl: { h: hsl.h ?? 0, s: hsl.s ?? 0, l: hsl.l ?? 0 },
      };
    }),
  };
}
