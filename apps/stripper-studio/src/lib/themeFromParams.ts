/**
 * Shared URL → color-scale derivation used by both the studio app (initial
 * state, generation) and the /api/colors serverless endpoint. Pure: no React,
 * no window, no path aliases — so it can be bundled by Vite and by Vercel's
 * function bundler alike.
 */
import {
  defaultConfig,
  familyById,
  generateScale,
  oklchOf,
  scaleFromFamily,
  type Scale,
  type ScaleConfig,
  type ThemeScales,
} from 'stripper';
import { MAX_ANCHORS } from './configExport';

/** App-layer role defaults: the engine default (balanced curve + consistent APCA contrast). */
export const DEFAULTS: ScaleConfig = defaultConfig();

export const DEFAULT_PRIMARY_ANCHOR = '#b766dc';
export const DEFAULT_NEUTRAL_ANCHOR = '#a49aa8';

export type NeutralTint = 'own' | 'primary';

/** The scale-independent state encoded in a studio URL (dark is UI chrome, handled by the app). */
export interface StudioParams {
  primaryAnchors: string[];
  neutralAnchors: string[];
  primaryConfig: ScaleConfig;
  neutralConfig: ScaleConfig;
  neutralTint: NeutralTint;
  /** active exact-preset Tailwind family per scale (null = generated) */
  primaryPreset: string | null;
  neutralPreset: string | null;
}

export interface ScaleResult {
  scale: Scale | null;
  error: string | null;
}

/**
 * Migrate legacy URL configs that still carry the old `consistentContrast`
 * boolean to the `contrastMode` enum.
 */
export function migrateLegacyConfig(
  raw: Partial<ScaleConfig> & { consistentContrast?: boolean },
): Partial<ScaleConfig> {
  const { consistentContrast, ...rest } = raw;
  if (typeof consistentContrast === 'boolean') {
    rest.contrastMode = consistentContrast ? 'apca' : 'none';
  }
  return rest;
}

function decodeConfig(param: string | null, fallback: ScaleConfig): ScaleConfig | null {
  if (!param) return null;
  try {
    const parsed = JSON.parse(atob(param)) as Partial<ScaleConfig> & { consistentContrast?: boolean };
    return { ...fallback, ...migrateLegacyConfig(parsed) };
  } catch {
    return null;
  }
}

function anchorsFromUrl(q: URLSearchParams, first: string, extraPrefix: string): string[] {
  const anchors = [first];
  for (let i = 2; i <= MAX_ANCHORS; i++) {
    const extra = q.get(`${extraPrefix}${i}`);
    if (extra) anchors.push(extra);
  }
  return anchors;
}

function presetFromUrl(q: URLSearchParams, param: string): string | null {
  const id = q.get(param);
  return id && familyById(id) ? id : null;
}

/** The 500-shade hex of a preset family (null-safe). */
function presetAnchorHex(familyId: string | null): string | undefined {
  return familyId ? familyById(familyId)?.shades.find((shade) => shade.number === 500)?.hex : undefined;
}

/**
 * Derive the full param state from a studio URL query. Absent params fall
 * back to defaults; anchors fall back to the active preset's 500 shade so
 * URL-only presets stay self-consistent.
 */
export function stateFromParams(q: URLSearchParams): StudioParams {
  const primaryPreset = q.has('ppreset') ? presetFromUrl(q, 'ppreset') : null;
  const neutralPreset = q.has('npreset') ? presetFromUrl(q, 'npreset') : null;
  const p = q.get('p');
  const n = q.get('n');
  const pcfg = decodeConfig(q.get('pcfg'), DEFAULTS);
  const ncfg = decodeConfig(q.get('ncfg'), DEFAULTS);
  const tint = q.get('ntint');
  return {
    primaryAnchors: p ? anchorsFromUrl(q, p, 'p') : [presetAnchorHex(primaryPreset) ?? DEFAULT_PRIMARY_ANCHOR],
    neutralAnchors: n ? anchorsFromUrl(q, n, 'n') : [presetAnchorHex(neutralPreset) ?? DEFAULT_NEUTRAL_ANCHOR],
    primaryConfig: pcfg ?? { ...DEFAULTS },
    neutralConfig: ncfg ?? { ...DEFAULTS },
    neutralTint: tint === 'own' || tint === 'primary' ? tint : 'own',
    primaryPreset,
    neutralPreset,
  };
}

/**
 * Serialize the param state back into studio URL params — the inverse of
 * {@link stateFromParams}. `dark` (UI chrome) is only included when set; the
 * /api/colors endpoint tolerates its presence either way.
 */
export function paramsFromState(
  state: StudioParams & { dark?: boolean },
): URLSearchParams {
  const q = new URLSearchParams();
  q.set('p', state.primaryAnchors[0]!);
  state.primaryAnchors.slice(1).forEach((hex, i) => q.set(`p${i + 2}`, hex));
  q.set('n', state.neutralAnchors[0]!);
  state.neutralAnchors.slice(1).forEach((hex, i) => q.set(`n${i + 2}`, hex));
  q.set('pcfg', btoa(JSON.stringify(state.primaryConfig)));
  q.set('ncfg', btoa(JSON.stringify(state.neutralConfig)));
  q.set('ntint', state.neutralTint);
  if (state.dark) q.set('dark', '1');
  if (state.primaryPreset) q.set('ppreset', state.primaryPreset);
  if (state.neutralPreset) q.set('npreset', state.neutralPreset);
  return q;
}

/** Primary scale: exact-preset family short-circuit, then generated from anchors. */
export function generatePrimary(params: {
  preset: string | null;
  anchors: string[];
  config: ScaleConfig;
}): ScaleResult {
  if (params.preset) {
    const family = familyById(params.preset);
    if (family) return { scale: scaleFromFamily(family), error: null };
  }
  try {
    return { scale: generateScale(params.anchors, params.config), error: null };
  } catch (e) {
    return { scale: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Neutral scale: preset short-circuit, then tint borrow from the primary anchor. */
export function generateNeutral(params: {
  preset: string | null;
  anchors: string[];
  config: ScaleConfig;
  tint: NeutralTint;
  primaryAnchors: string[];
}): ScaleResult {
  if (params.preset) {
    const family = familyById(params.preset);
    if (family) return { scale: scaleFromFamily(family), error: null };
  }
  let config = params.config;
  // tint only applies to single-anchor scales (carve-out)
  if (params.tint === 'primary' && params.anchors.length === 1) {
    try {
      const primaryHue = oklchOf(params.primaryAnchors[0]!).h;
      if (Number.isFinite(primaryHue)) {
        config = { ...config, hue: { ...config.hue, tint: primaryHue } };
      }
    } catch {
      // unparseable primary anchor: skip tint (URL junk is sanitized upstream)
    }
  }
  try {
    return { scale: generateScale(params.anchors, config), error: null };
  } catch (e) {
    return { scale: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface ThemeResult {
  /** the two scales in role order, or null when generation failed */
  scales: ThemeScales | null;
  error: string | null;
}

/** Derive the color scales from a studio URL query — the same derivation the studio UI performs. */
export function themeFromParams(q: URLSearchParams): ThemeResult {
  const p = stateFromParams(q);
  const primary = generatePrimary({ preset: p.primaryPreset, anchors: p.primaryAnchors, config: p.primaryConfig });
  const neutral = generateNeutral({
    preset: p.neutralPreset,
    anchors: p.neutralAnchors,
    config: p.neutralConfig,
    tint: p.neutralTint,
    primaryAnchors: p.primaryAnchors,
  });
  if (primary.scale && neutral.scale) {
    return {
      scales: [
        { name: 'primary', scale: primary.scale },
        { name: 'neutral', scale: neutral.scale },
      ],
      error: null,
    };
  }
  return { scales: null, error: primary.error ?? neutral.error ?? 'invalid params' };
}
