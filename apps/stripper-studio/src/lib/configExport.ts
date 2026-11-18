import { defaultConfig, familyById, MAX_ANCHORS, type ScaleConfig } from 'stripper';

export { MAX_ANCHORS };

/** The configuration applied to the color schemes, per scheme. */
export interface ConfigExportInput {
  /** active per-scale preset (Tailwind family id) — the scale is the exact family, not generated */
  preset: { primary: string | null; neutral: string | null };
  primary: { anchors: string[]; config: ScaleConfig };
  neutral: { anchors: string[]; config: ScaleConfig; tint: 'own' | 'primary' };
}

/** The studio state fields a config JSON restores (everything except `dark`). */
export interface StudioConfigSnapshot {
  primaryAnchors: string[];
  neutralAnchors: string[];
  primaryConfig: ScaleConfig;
  neutralConfig: ScaleConfig;
  neutralTint: 'own' | 'primary';
  primaryPreset: string | null;
  neutralPreset: string | null;
}

/**
 * JSON of the applied configuration — the recipe, not the tokens: anchors plus
 * the ScaleConfig each scheme was generated with (and the neutral tint rule).
 * A scheme whose preset is set renders the exact Tailwind family instead.
 */
export function buildConfigJson(input: ConfigExportInput): string {
  return (
    JSON.stringify(
      {
        primary: { anchors: input.primary.anchors, config: input.primary.config },
        neutral: { anchors: input.neutral.anchors, config: input.neutral.config, tint: input.neutral.tint },
        preset: input.preset,
      },
      null,
      2,
    ) + '\n'
  );
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function sanitizeConfig(raw: unknown): ScaleConfig {
  const out = defaultConfig();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Partial<ScaleConfig> & { consistentContrast?: boolean; hue?: Record<string, unknown>; chroma?: Record<string, unknown> };
  if (r.baseMode === 'tailwindTransfer' || r.baseMode === 'balancedCurve') out.baseMode = r.baseMode;
  if (r.contrastMode === 'none' || r.contrastMode === 'apca' || r.contrastMode === 'wcag') {
    out.contrastMode = r.contrastMode;
  } else if (typeof r.consistentContrast === 'boolean') {
    // legacy configs may still carry the old boolean
    out.contrastMode = r.consistentContrast ? 'apca' : 'none';
  }
  if (typeof r.keepAnchorsExact === 'boolean') out.keepAnchorsExact = r.keepAnchorsExact;
  if (typeof r.hue?.tint === 'number') out.hue = { ...out.hue, tint: r.hue.tint };
  if (typeof r.hue?.driftLight === 'number') out.hue = { ...out.hue, driftLight: clamp(r.hue.driftLight, -60, 60) };
  if (typeof r.hue?.driftDark === 'number') out.hue = { ...out.hue, driftDark: clamp(r.hue.driftDark, -60, 60) };
  if (typeof r.chroma?.taperLight === 'number') out.chroma = { ...out.chroma, taperLight: clamp(r.chroma.taperLight, 0, 1.5) };
  if (typeof r.chroma?.taperDark === 'number') out.chroma = { ...out.chroma, taperDark: clamp(r.chroma.taperDark, 0, 1.5) };
  return out;
}

function sanitizeAnchors(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const hexes = raw
    .filter((a): a is string => typeof a === 'string' && HEX_RE.test(a))
    .map((a) => a.toLowerCase());
  if (hexes.length === 0) return null;
  return hexes.slice(0, MAX_ANCHORS);
}

function sanitizePreset(raw: unknown): string | null {
  return typeof raw === 'string' && familyById(raw) ? raw : null;
}

/**
 * Parse a config JSON (the export of {@link buildConfigJson}) back into studio
 * state fields. Unknown/invalid values fall back to their defaults; unknown
 * preset ids resolve to null (generated scales). Returns null when the file
 * does not contain usable anchors for both scales.
 */
export function parseConfigJson(text: string): StudioConfigSnapshot | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const root = parsed as {
    primary?: { anchors?: unknown; config?: unknown };
    neutral?: { anchors?: unknown; config?: unknown; tint?: unknown };
    preset?: { primary?: unknown; neutral?: unknown };
  };
  const primaryAnchors = sanitizeAnchors(root.primary?.anchors);
  const neutralAnchors = sanitizeAnchors(root.neutral?.anchors);
  if (!primaryAnchors || !neutralAnchors) return null;
  return {
    primaryAnchors,
    neutralAnchors,
    primaryConfig: sanitizeConfig(root.primary?.config),
    neutralConfig: sanitizeConfig(root.neutral?.config),
    neutralTint: root.neutral?.tint === 'primary' ? 'primary' : 'own',
    primaryPreset: sanitizePreset(root.preset?.primary),
    neutralPreset: sanitizePreset(root.preset?.neutral),
  };
}
