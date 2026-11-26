import { defaultConfig, familyById, MAX_ANCHORS, type ScaleConfig } from '@mountfx/stripper';

export { MAX_ANCHORS };

/** One scheme's configuration, as exported in a config JSON. */
export interface SchemeConfigExport {
  /** the scheme name — drives token names in the other exports */
  name: string;
  /** active preset (Tailwind family id) — the scale is the exact family, not generated */
  preset: string | null;
  anchors: string[];
  config: ScaleConfig;
}

export interface ConfigExportInput {
  schemes: SchemeConfigExport[];
}

/** The studio state fields a config JSON restores (everything except `dark`). */
export interface StudioConfigSnapshot {
  schemes: SchemeConfigExport[];
}

/**
 * JSON of the applied configuration — the recipe, not the tokens: per scheme
 * the anchors plus the ScaleConfig it was generated with. A scheme whose
 * preset is set renders the exact Tailwind family instead.
 */
export function buildConfigJson(input: ConfigExportInput): string {
  return (
    JSON.stringify(
      {
        schemes: input.schemes.map((scheme) => ({
          name: scheme.name,
          preset: scheme.preset,
          anchors: scheme.anchors,
          config: scheme.config,
        })),
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

function sanitizeName(raw: unknown, index: number): string {
  return typeof raw === 'string' ? raw.trim() || `scheme${index + 1}` : `scheme${index + 1}`;
}

/**
 * Parse a config JSON (the export of {@link buildConfigJson}) back into studio
 * state schemes. Unknown/invalid values fall back to their defaults; unknown
 * preset ids resolve to null (generated scales); schemes without usable
 * anchors are dropped. Returns null when no scheme is usable.
 */
export function parseConfigJson(text: string): StudioConfigSnapshot | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const root = parsed as { schemes?: unknown };
  if (!Array.isArray(root.schemes)) return null;
  const schemes: SchemeConfigExport[] = [];
  root.schemes.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') return;
    const r = raw as { name?: unknown; preset?: unknown; anchors?: unknown; config?: unknown };
    const anchors = sanitizeAnchors(r.anchors);
    if (!anchors) return;
    schemes.push({
      name: sanitizeName(r.name, index),
      preset: sanitizePreset(r.preset),
      anchors,
      config: sanitizeConfig(r.config),
    });
  });
  return schemes.length > 0 ? { schemes } : null;
}
