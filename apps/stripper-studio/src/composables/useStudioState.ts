import { computed, reactive, ref, watch } from 'vue';
import {
  KONVERTO_PRESET,
  SCALE_STEPS,
  defaultConfig,
  generateScale,
  oklchOf,
  type Scale,
  type ScaleConfig,
  type ScaleStepNumber,
} from 'stripper';
import { parse, converter, formatHex as culoriFormatHex } from 'culori';
import { studioThemeCss } from '@/lib/semantic';

const toOklch = converter('oklch');
const toHsl = converter('hsl');

/**
 * App-layer role presets: the engine is role-agnostic, the studio decides that
 * primary scales use consistent contrast and neutrals keep their own lightness
 * with a tint dropdown.
 */
const PRIMARY_DEFAULTS: ScaleConfig = defaultConfig();
const NEUTRAL_DEFAULTS: ScaleConfig = { ...defaultConfig(), contrastMode: 'none' };

export type NeutralTint = 'own' | 'primary';

/** brand colors per scale; 1 = classic single-anchor scale, 2-4 = multi-anchor transitions */
export const MAX_ANCHORS = 4;

export interface StudioState {
  primaryAnchors: string[];
  neutralAnchors: string[];
  primaryConfig: ScaleConfig;
  neutralConfig: ScaleConfig;
  neutralTint: NeutralTint;
  dark: boolean;
  presetMode: boolean;
}

function presetScale(steps: Record<string, string>): Scale {
  return {
    input: steps['500']!,
    anchorStep: 500,
    anchors: [{ step: 500, hex: steps['500']! }],
    closestFamily: undefined,
    warnings: [],
    steps: SCALE_STEPS.map((n) => {
      const hex = steps[String(n)]!;
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

const KONVERTO_PRIMARY_SCALE = presetScale(KONVERTO_PRESET.primary.steps as Record<string, string>);
const KONVERTO_NEUTRAL_SCALE = presetScale(KONVERTO_PRESET.neutral.steps as Record<string, string>);

/**
 * Migrate legacy URL configs that still carry the old `consistentContrast`
 * boolean to the `contrastMode` enum.
 */
export function migrateLegacyConfig(raw: Partial<ScaleConfig> & { consistentContrast?: boolean }): Partial<ScaleConfig> {
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

function loadFromUrl(): Partial<StudioState> | null {
  const q = new URLSearchParams(window.location.search);
  if (!q.has('p') && !q.has('n') && !q.has('pcfg') && !q.has('ncfg')) return null;
  const state: Partial<StudioState> = {};
  const p = q.get('p');
  const n = q.get('n');
  if (p) state.primaryAnchors = anchorsFromUrl(q, p, 'p');
  if (n) state.neutralAnchors = anchorsFromUrl(q, n, 'n');
  const pcfg = decodeConfig(q.get('pcfg'), PRIMARY_DEFAULTS);
  if (pcfg) state.primaryConfig = pcfg;
  const ncfg = decodeConfig(q.get('ncfg'), NEUTRAL_DEFAULTS);
  if (ncfg) state.neutralConfig = ncfg;
  const tint = q.get('ntint');
  if (tint === 'own' || tint === 'primary') state.neutralTint = tint;
  state.dark = q.get('dark') === '1';
  state.presetMode = q.get('preset') === 'konverto';
  return state;
}

const urlState = loadFromUrl();

export const state = reactive<StudioState>({
  primaryAnchors: urlState?.primaryAnchors ?? ['#a286fd'],
  neutralAnchors: urlState?.neutralAnchors ?? ['#798680'],
  primaryConfig: urlState?.primaryConfig ?? { ...PRIMARY_DEFAULTS },
  neutralConfig: urlState?.neutralConfig ?? { ...NEUTRAL_DEFAULTS },
  neutralTint: urlState?.neutralTint ?? 'own',
  dark: urlState?.dark ?? false,
  presetMode: urlState?.presetMode ?? false,
});

export interface ScaleResult {
  scale: Scale | null;
  error: string | null;
}

function tryGenerate(anchors: string[], config: ScaleConfig): ScaleResult {
  try {
    return { scale: generateScale(anchors, config), error: null };
  } catch (e) {
    return { scale: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export const primaryResult = computed<ScaleResult>(() => {
  if (state.presetMode) return { scale: KONVERTO_PRIMARY_SCALE, error: null };
  return tryGenerate(state.primaryAnchors, state.primaryConfig);
});

export const neutralResult = computed<ScaleResult>(() => {
  if (state.presetMode) return { scale: KONVERTO_NEUTRAL_SCALE, error: null };
  let config = state.neutralConfig;
  // tint only applies to single-anchor scales (carve-out)
  if (state.neutralTint === 'primary' && state.neutralAnchors.length === 1) {
    const primaryHue = oklchOf(state.primaryAnchors[0]!).h;
    if (Number.isFinite(primaryHue)) {
      config = { ...config, hue: { ...config.hue, tint: primaryHue } };
    }
  }
  return tryGenerate(state.neutralAnchors, config);
});

export function markCustom() {
  state.presetMode = false;
}

export function applyKonvertoPreset() {
  state.primaryAnchors = ['#a286fd'];
  state.neutralAnchors = ['#798680'];
  state.primaryConfig = { ...PRIMARY_DEFAULTS };
  state.neutralConfig = { ...NEUTRAL_DEFAULTS };
  state.neutralTint = 'own';
  state.presetMode = true;
}

export function applyRandom() {
  markCustom();
  const hue = Math.floor(Math.random() * 360);
  const sat = 0.55 + Math.random() * 0.35;
  const light = 0.5 + Math.random() * 0.2;
  state.primaryAnchors = [culoriFormatHex({ mode: 'hsl', h: hue, s: sat, l: light }) ?? '#888888'];
  state.neutralAnchors = [culoriFormatHex({ mode: 'hsl', h: hue, s: sat * 0.12, l: light }) ?? '#888888'];
}

// ---- URL sync -----------------------------------------------------------------
let syncTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => [state.primaryAnchors, state.neutralAnchors, state.primaryConfig, state.neutralConfig, state.neutralTint, state.dark, state.presetMode],
  () => {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      const q = new URLSearchParams();
      q.set('p', state.primaryAnchors[0]!);
      state.primaryAnchors.slice(1).forEach((hex, i) => q.set(`p${i + 2}`, hex));
      q.set('n', state.neutralAnchors[0]!);
      state.neutralAnchors.slice(1).forEach((hex, i) => q.set(`n${i + 2}`, hex));
      q.set('pcfg', btoa(JSON.stringify(state.primaryConfig)));
      q.set('ncfg', btoa(JSON.stringify(state.neutralConfig)));
      q.set('ntint', state.neutralTint);
      if (state.dark) q.set('dark', '1');
      if (state.presetMode) q.set('preset', 'konverto');
      window.history.replaceState(null, '', `${window.location.pathname}?${q.toString()}`);
    }, 300);
  },
  { deep: true },
);

// ---- dark mode -----------------------------------------------------------------
watch(
  () => state.dark,
  (dark) => {
    document.documentElement.classList.toggle('dark', dark);
  },
  { immediate: true },
);

// ---- live theming: apply the generated scales to the studio UI -------------------
const THEME_STYLE_ID = 'studio-theme';

function applyStudioTheme(primary: Scale | null, neutral: Scale | null) {
  if (!primary || !neutral) return;
  let style = document.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = THEME_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = studioThemeCss(primary, neutral);
}

watch(
  () => [primaryResult.value.scale, neutralResult.value.scale] as const,
  ([p, n]) => applyStudioTheme(p ?? null, n ?? null),
  { immediate: true },
);

// ---- focus sync -----------------------------------------------------------------
/**
 * The scale step (50–950) currently hovered anywhere in the UI, keyed by which
 * scale it belongs to — hovering a swatch, a contrast-matrix row, or a chart
 * dot focuses that color across that scale's surfaces only. Ephemeral, not
 * URL-synced.
 */
export type ScaleKey = 'primary' | 'neutral';

export const focused = ref<{ key: ScaleKey; step: ScaleStepNumber } | null>(null);

export function setFocused(key: ScaleKey, step: ScaleStepNumber): void {
  focused.value = { key, step };
}

export function clearFocused(key: ScaleKey): void {
  if (focused.value?.key === key) focused.value = null;
}

export function isFocused(key: ScaleKey, step: ScaleStepNumber): boolean {
  return focused.value?.key === key && focused.value.step === step;
}
