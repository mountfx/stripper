/**
 * Tailwind CSS v4 default color families (sRGB hex), 11 steps 50-950.
 * Used as base curves for the tailwindTransfer generator mode.
 * Data extracted from the Tailwind v4 palette and verified against uicolors.
 */
import { parse, converter } from 'culori';

const toOklch = converter('oklch');
const toHsl = converter('hsl');
import { SCALE_STEPS, type Scale, type ScaleStepNumber } from './types';

export interface FamilyShade { number: ScaleStepNumber; hex: string }
export interface ColorFamily { name: string; id: string; shades: FamilyShade[] }

export const TAILWIND_FAMILIES: ColorFamily[] = [
  { name: "Red", id: "red", shades: [
    { number: 50, hex: "#fef2f2" },
    { number: 100, hex: "#fee2e2" },
    { number: 200, hex: "#fecaca" },
    { number: 300, hex: "#fca5a5" },
    { number: 400, hex: "#f87171" },
    { number: 500, hex: "#ef4444" },
    { number: 600, hex: "#dc2626" },
    { number: 700, hex: "#b91c1c" },
    { number: 800, hex: "#991b1b" },
    { number: 900, hex: "#7f1d1d" },
    { number: 950, hex: "#450a0a" },
  ] },
  { name: "Orange", id: "orange", shades: [
    { number: 50, hex: "#fff7ed" },
    { number: 100, hex: "#ffedd5" },
    { number: 200, hex: "#fed7aa" },
    { number: 300, hex: "#fdba74" },
    { number: 400, hex: "#fb923c" },
    { number: 500, hex: "#f97316" },
    { number: 600, hex: "#ea580c" },
    { number: 700, hex: "#c2410c" },
    { number: 800, hex: "#9a3412" },
    { number: 900, hex: "#7c2d12" },
    { number: 950, hex: "#431407" },
  ] },
  { name: "Amber", id: "amber", shades: [
    { number: 50, hex: "#fffbeb" },
    { number: 100, hex: "#fef3c7" },
    { number: 200, hex: "#fde68a" },
    { number: 300, hex: "#fcd34d" },
    { number: 400, hex: "#fbbf24" },
    { number: 500, hex: "#f59e0b" },
    { number: 600, hex: "#d97706" },
    { number: 700, hex: "#b45309" },
    { number: 800, hex: "#92400e" },
    { number: 900, hex: "#78350f" },
    { number: 950, hex: "#451a03" },
  ] },
  { name: "Yellow", id: "yellow", shades: [
    { number: 50, hex: "#fefce8" },
    { number: 100, hex: "#fef9c3" },
    { number: 200, hex: "#fef08a" },
    { number: 300, hex: "#fde047" },
    { number: 400, hex: "#facc15" },
    { number: 500, hex: "#eab308" },
    { number: 600, hex: "#ca8a04" },
    { number: 700, hex: "#a16207" },
    { number: 800, hex: "#854d0e" },
    { number: 900, hex: "#713f12" },
    { number: 950, hex: "#422006" },
  ] },
  { name: "Lime", id: "lime", shades: [
    { number: 50, hex: "#f7fee7" },
    { number: 100, hex: "#ecfccb" },
    { number: 200, hex: "#d9f99d" },
    { number: 300, hex: "#bef264" },
    { number: 400, hex: "#a3e635" },
    { number: 500, hex: "#84cc16" },
    { number: 600, hex: "#65a30d" },
    { number: 700, hex: "#4d7c0f" },
    { number: 800, hex: "#3f6212" },
    { number: 900, hex: "#365314" },
    { number: 950, hex: "#1a2e05" },
  ] },
  { name: "Green", id: "green", shades: [
    { number: 50, hex: "#f0fdf4" },
    { number: 100, hex: "#dcfce7" },
    { number: 200, hex: "#bbf7d0" },
    { number: 300, hex: "#86efac" },
    { number: 400, hex: "#4ade80" },
    { number: 500, hex: "#22c55e" },
    { number: 600, hex: "#16a34a" },
    { number: 700, hex: "#15803d" },
    { number: 800, hex: "#166534" },
    { number: 900, hex: "#14532d" },
    { number: 950, hex: "#052e16" },
  ] },
  { name: "Emerald", id: "emerald", shades: [
    { number: 50, hex: "#ecfdf5" },
    { number: 100, hex: "#d1fae5" },
    { number: 200, hex: "#a7f3d0" },
    { number: 300, hex: "#6ee7b7" },
    { number: 400, hex: "#34d399" },
    { number: 500, hex: "#10b981" },
    { number: 600, hex: "#059669" },
    { number: 700, hex: "#047857" },
    { number: 800, hex: "#065f46" },
    { number: 900, hex: "#064e3b" },
    { number: 950, hex: "#022c22" },
  ] },
  { name: "Teal", id: "teal", shades: [
    { number: 50, hex: "#f0fdfa" },
    { number: 100, hex: "#ccfbf1" },
    { number: 200, hex: "#99f6e4" },
    { number: 300, hex: "#5eead4" },
    { number: 400, hex: "#2dd4bf" },
    { number: 500, hex: "#14b8a6" },
    { number: 600, hex: "#0d9488" },
    { number: 700, hex: "#0f766e" },
    { number: 800, hex: "#115e59" },
    { number: 900, hex: "#134e4a" },
    { number: 950, hex: "#042f2e" },
  ] },
  { name: "Cyan", id: "cyan", shades: [
    { number: 50, hex: "#ecfeff" },
    { number: 100, hex: "#cffafe" },
    { number: 200, hex: "#a5f3fc" },
    { number: 300, hex: "#67e8f9" },
    { number: 400, hex: "#22d3ee" },
    { number: 500, hex: "#06b6d4" },
    { number: 600, hex: "#0891b2" },
    { number: 700, hex: "#0e7490" },
    { number: 800, hex: "#155e75" },
    { number: 900, hex: "#164e63" },
    { number: 950, hex: "#083344" },
  ] },
  { name: "Sky", id: "sky", shades: [
    { number: 50, hex: "#f0f9ff" },
    { number: 100, hex: "#e0f2fe" },
    { number: 200, hex: "#bae6fd" },
    { number: 300, hex: "#7dd3fc" },
    { number: 400, hex: "#38bdf8" },
    { number: 500, hex: "#0ea5e9" },
    { number: 600, hex: "#0284c7" },
    { number: 700, hex: "#0369a1" },
    { number: 800, hex: "#075985" },
    { number: 900, hex: "#0c4a6e" },
    { number: 950, hex: "#082f49" },
  ] },
  { name: "Blue", id: "blue", shades: [
    { number: 50, hex: "#eff6ff" },
    { number: 100, hex: "#dbeafe" },
    { number: 200, hex: "#bfdbfe" },
    { number: 300, hex: "#93c5fd" },
    { number: 400, hex: "#60a5fa" },
    { number: 500, hex: "#3b82f6" },
    { number: 600, hex: "#2563eb" },
    { number: 700, hex: "#1d4ed8" },
    { number: 800, hex: "#1e40af" },
    { number: 900, hex: "#1e3a8a" },
    { number: 950, hex: "#172554" },
  ] },
  { name: "Indigo", id: "indigo", shades: [
    { number: 50, hex: "#eef2ff" },
    { number: 100, hex: "#e0e7ff" },
    { number: 200, hex: "#c7d2fe" },
    { number: 300, hex: "#a5b4fc" },
    { number: 400, hex: "#818cf8" },
    { number: 500, hex: "#6366f1" },
    { number: 600, hex: "#4f46e5" },
    { number: 700, hex: "#4338ca" },
    { number: 800, hex: "#3730a3" },
    { number: 900, hex: "#312e81" },
    { number: 950, hex: "#1e1b4b" },
  ] },
  { name: "Violet", id: "violet", shades: [
    { number: 50, hex: "#f5f3ff" },
    { number: 100, hex: "#ede9fe" },
    { number: 200, hex: "#ddd6fe" },
    { number: 300, hex: "#c4b5fd" },
    { number: 400, hex: "#a78bfa" },
    { number: 500, hex: "#8b5cf6" },
    { number: 600, hex: "#7c3aed" },
    { number: 700, hex: "#6d28d9" },
    { number: 800, hex: "#5b21b6" },
    { number: 900, hex: "#4c1d95" },
    { number: 950, hex: "#2e1065" },
  ] },
  { name: "Purple", id: "purple", shades: [
    { number: 50, hex: "#faf5ff" },
    { number: 100, hex: "#f3e8ff" },
    { number: 200, hex: "#e9d5ff" },
    { number: 300, hex: "#d8b4fe" },
    { number: 400, hex: "#c084fc" },
    { number: 500, hex: "#a855f7" },
    { number: 600, hex: "#9333ea" },
    { number: 700, hex: "#7e22ce" },
    { number: 800, hex: "#6b21a8" },
    { number: 900, hex: "#581c87" },
    { number: 950, hex: "#3b0764" },
  ] },
  { name: "Fuchsia", id: "fuchsia", shades: [
    { number: 50, hex: "#fdf4ff" },
    { number: 100, hex: "#fae8ff" },
    { number: 200, hex: "#f5d0fe" },
    { number: 300, hex: "#f0abfc" },
    { number: 400, hex: "#e879f9" },
    { number: 500, hex: "#d946ef" },
    { number: 600, hex: "#c026d3" },
    { number: 700, hex: "#a21caf" },
    { number: 800, hex: "#86198f" },
    { number: 900, hex: "#701a75" },
    { number: 950, hex: "#4a044e" },
  ] },
  { name: "Pink", id: "pink", shades: [
    { number: 50, hex: "#fdf2f8" },
    { number: 100, hex: "#fce7f3" },
    { number: 200, hex: "#fbcfe8" },
    { number: 300, hex: "#f9a8d4" },
    { number: 400, hex: "#f472b6" },
    { number: 500, hex: "#ec4899" },
    { number: 600, hex: "#db2777" },
    { number: 700, hex: "#be185d" },
    { number: 800, hex: "#9d174d" },
    { number: 900, hex: "#831843" },
    { number: 950, hex: "#500724" },
  ] },
  { name: "Rose", id: "rose", shades: [
    { number: 50, hex: "#fff1f2" },
    { number: 100, hex: "#ffe4e6" },
    { number: 200, hex: "#fecdd3" },
    { number: 300, hex: "#fda4af" },
    { number: 400, hex: "#fb7185" },
    { number: 500, hex: "#f43f5e" },
    { number: 600, hex: "#e11d48" },
    { number: 700, hex: "#be123c" },
    { number: 800, hex: "#9f1239" },
    { number: 900, hex: "#881337" },
    { number: 950, hex: "#4c0519" },
  ] },
  { name: "Slate", id: "slate", shades: [
    { number: 50, hex: "#f8fafc" },
    { number: 100, hex: "#f1f5f9" },
    { number: 200, hex: "#e2e8f0" },
    { number: 300, hex: "#cbd5e1" },
    { number: 400, hex: "#94a3b8" },
    { number: 500, hex: "#64748b" },
    { number: 600, hex: "#475569" },
    { number: 700, hex: "#334155" },
    { number: 800, hex: "#1e293b" },
    { number: 900, hex: "#0f172a" },
    { number: 950, hex: "#020617" },
  ] },
  { name: "Gray", id: "gray", shades: [
    { number: 50, hex: "#f9fafb" },
    { number: 100, hex: "#f3f4f6" },
    { number: 200, hex: "#e5e7eb" },
    { number: 300, hex: "#d1d5db" },
    { number: 400, hex: "#9ca3af" },
    { number: 500, hex: "#6b7280" },
    { number: 600, hex: "#4b5563" },
    { number: 700, hex: "#374151" },
    { number: 800, hex: "#1f2937" },
    { number: 900, hex: "#111827" },
    { number: 950, hex: "#030712" },
  ] },
  { name: "Zinc", id: "zinc", shades: [
    { number: 50, hex: "#fafafa" },
    { number: 100, hex: "#f4f4f5" },
    { number: 200, hex: "#e4e4e7" },
    { number: 300, hex: "#d4d4d8" },
    { number: 400, hex: "#a1a1aa" },
    { number: 500, hex: "#71717a" },
    { number: 600, hex: "#52525b" },
    { number: 700, hex: "#3f3f46" },
    { number: 800, hex: "#27272a" },
    { number: 900, hex: "#18181b" },
    { number: 950, hex: "#09090b" },
  ] },
  { name: "Neutral", id: "neutral", shades: [
    { number: 50, hex: "#fafafa" },
    { number: 100, hex: "#f5f5f5" },
    { number: 200, hex: "#e5e5e5" },
    { number: 300, hex: "#d4d4d4" },
    { number: 400, hex: "#a3a3a3" },
    { number: 500, hex: "#737373" },
    { number: 600, hex: "#525252" },
    { number: 700, hex: "#404040" },
    { number: 800, hex: "#262626" },
    { number: 900, hex: "#171717" },
    { number: 950, hex: "#0a0a0a" },
  ] },
  { name: "Stone", id: "stone", shades: [
    { number: 50, hex: "#fafaf9" },
    { number: 100, hex: "#f5f5f4" },
    { number: 200, hex: "#e7e5e4" },
    { number: 300, hex: "#d6d3d1" },
    { number: 400, hex: "#a8a29e" },
    { number: 500, hex: "#78716c" },
    { number: 600, hex: "#57534e" },
    { number: 700, hex: "#44403c" },
    { number: 800, hex: "#292524" },
    { number: 900, hex: "#1c1917" },
    { number: 950, hex: "#0c0a09" },
  ] },
];

export const GRAY_FAMILY_NAMES: Set<string> = new Set(['Slate', 'Gray', 'Zinc', 'Neutral', 'Stone']);

/**
 * Derived OKLCH profiles: per-step mean L and mean C across family groups.
 * `chromatic` powers the balancedCurve mode; `gray` provides the neutral fallback curve.
 */
export interface FamilyProfile {
  /** step number -> mean oklch L (0..1) */
  l: Record<number, number>;
  /** step number -> mean oklch C (0..0.4ish) */
  c: Record<number, number>;
}

function mean(values: number[]): number {
  return values.reduce((a, v) => a + v, 0) / values.length;
}

function buildProfile(names: string[]): FamilyProfile {
  const fams = TAILWIND_FAMILIES.filter((f) => names.includes(f.name));
  const l = {} as Record<ScaleStepNumber, number>;
  const c = {} as Record<ScaleStepNumber, number>;
  for (const step of fams[0]!.shades.map((s) => s.number)) {
    const ls: number[] = [];
    const cs: number[] = [];
    for (const f of fams) {
      const hex = f.shades.find((s) => s.number === step)!.hex;
      const col = parse(hex);
      const ok = toOklch(col)!;
      ls.push(ok.l);
      cs.push(ok.c);
    }
    l[step] = mean(ls);
    c[step] = mean(cs);
  }
  return { l, c };
}

export const CHROMATIC_PROFILE: FamilyProfile = buildProfile(
  TAILWIND_FAMILIES.filter((f) => !GRAY_FAMILY_NAMES.has(f.name)).map((f) => f.name),
);
export const GRAY_PROFILE: FamilyProfile = buildProfile([...GRAY_FAMILY_NAMES]);

const FAMILY_BY_ID = new Map(TAILWIND_FAMILIES.map((f) => [f.id, f]));

/** Look up a Tailwind family by its id (e.g. 'blue'). */
export function familyById(id: string): ColorFamily | undefined {
  return FAMILY_BY_ID.get(id);
}

/** Build an exact {@link Scale} from a Tailwind family — the family's own hex shades, anchored at 500. */
export function scaleFromFamily(family: ColorFamily): Scale {
  const hexByStep = new Map(family.shades.map((s) => [s.number, s.hex]));
  const input = hexByStep.get(500)!;
  return {
    input,
    anchorStep: 500,
    anchors: [{ step: 500, hex: input }],
    closestFamily: family.name,
    warnings: [],
    steps: SCALE_STEPS.map((n) => {
      const hex = hexByStep.get(n)!;
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
