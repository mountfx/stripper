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
  scaleFromFamily,
  type Scale,
  type ScaleConfig,
  type ThemeScales,
} from '@mountfx/stripper';
import { MAX_ANCHORS } from './configExport';

/** App-layer default: the engine default (balanced curve + consistent APCA contrast). */
export const DEFAULTS: ScaleConfig = defaultConfig();

export const DEFAULT_SCHEMES: Array<{ name: string; anchor: string }> = [
  { name: 'primary', anchor: '#b766dc' },
  { name: 'neutral', anchor: '#a49aa8' },
];

/** A user-defined color scheme: named, with its own anchors, config and preset. */
export interface SchemeParams {
  name: string;
  anchors: string[];
  config: ScaleConfig;
  /** active exact-preset Tailwind family (null = generated) */
  preset: string | null;
}

/** The scale-independent state encoded in a studio URL (dark is UI chrome, handled by the app). */
export interface StudioParams {
  schemes: SchemeParams[];
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

function decodeConfig(param: string | null): ScaleConfig {
  if (!param) return { ...DEFAULTS };
  try {
    const parsed = JSON.parse(atob(param)) as Partial<ScaleConfig> & { consistentContrast?: boolean };
    return { ...DEFAULTS, ...migrateLegacyConfig(parsed) };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Token-safe scheme name, or null when nothing usable remains. */
export function cleanSchemeName(raw: string | null): string | null {
  const cleaned = (raw ?? '').trim().replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || null;
}

/** Token-safe scheme name with an index fallback. */
export function sanitizeName(raw: string | null, index: number): string {
  return cleanSchemeName(raw) ?? `scheme${index + 1}`;
}

function anchorsFromUrl(q: URLSearchParams, first: string, prefix: string): string[] {
  const anchors = [first];
  for (let i = 2; i <= MAX_ANCHORS; i++) {
    const extra = q.get(`${prefix}_${i}`);
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

function schemeCount(q: URLSearchParams): number {
  let count = 0;
  while (q.has(`s${count + 1}`) || q.has(`s${count + 1}preset`)) count++;
  return count;
}

/** Anchor fallback chain: explicit param, then the preset's 500 shade, then the default anchor. */
function firstAnchor(q: URLSearchParams, prefix: string, preset: string | null, index: number): string {
  return q.get(prefix) ?? presetAnchorHex(preset) ?? DEFAULT_SCHEMES[index]?.anchor ?? '#888888';
}

/**
 * Derive the full param state from a studio URL query. Absent params fall
 * back to the default schemes; anchors fall back to the active preset's 500
 * shade so URL-only presets stay self-consistent.
 */
export function stateFromParams(q: URLSearchParams): StudioParams {
  const count = schemeCount(q);
  if (count === 0) {
    return {
      schemes: DEFAULT_SCHEMES.map(({ name, anchor }) => ({
        name,
        anchors: [anchor],
        config: { ...DEFAULTS },
        preset: null,
      })),
    };
  }
  const schemes: SchemeParams[] = [];
  for (let i = 0; i < count; i++) {
    const prefix = `s${i + 1}`;
    const preset = presetFromUrl(q, `${prefix}preset`);
    const first = firstAnchor(q, prefix, preset, i);
    schemes.push({
      name: sanitizeName(q.get(`${prefix}name`), i),
      anchors: [first, ...anchorsFromUrl(q, first, prefix).slice(1)],
      config: decodeConfig(q.get(`${prefix}cfg`)),
      preset,
    });
  }
  return { schemes };
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
  state.schemes.forEach((scheme, i) => {
    const prefix = `s${i + 1}`;
    q.set(prefix, scheme.anchors[0]!);
    scheme.anchors.slice(1).forEach((hex, k) => q.set(`${prefix}_${k + 2}`, hex));
    q.set(`${prefix}cfg`, btoa(JSON.stringify(scheme.config)));
    if (scheme.preset) q.set(`${prefix}preset`, scheme.preset);
    q.set(`${prefix}name`, scheme.name);
  });
  if (state.dark) q.set('dark', '1');
  return q;
}

/** One color scheme: exact-preset family short-circuit, then generated from anchors. */
export function generateScheme(params: {
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

export interface ThemeResult {
  /** one scale per scheme in order, or null when any generation failed */
  scales: ThemeScales | null;
  error: string | null;
}

/** Derive the color scales from a studio URL query — the same derivation the studio UI performs. */
export function themeFromParams(q: URLSearchParams): ThemeResult {
  const p = stateFromParams(q);
  const results = p.schemes.map((scheme) => generateScheme(scheme));
  const failed = results.findIndex((r) => !r.scale);
  if (failed === -1) {
    return {
      scales: p.schemes.map((scheme, i) => ({ name: scheme.name, scale: results[i]!.scale! })),
      error: null,
    };
  }
  return { scales: null, error: results[failed]!.error ?? 'invalid params' };
}
