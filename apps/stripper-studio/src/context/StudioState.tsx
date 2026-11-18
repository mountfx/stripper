import {
  createContext,
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  defaultConfig,
  familyById,
  generateScale,
  oklchOf,
  scaleFromFamily,
  TAILWIND_FAMILIES,
  type Scale,
  type ScaleConfig,
  type ScaleStepNumber,
} from 'stripper';
import { formatHex as culoriFormatHex } from 'culori';
import { MAX_ANCHORS, parseConfigJson } from '@/lib/configExport';

export { MAX_ANCHORS };

/**
 * App-layer role defaults: both scales run the balanced curve with the
 * consistent APCA ladder by default; the neutral keeps tint 'own'.
 */
const PRIMARY_DEFAULTS: ScaleConfig = { ...defaultConfig(), baseMode: 'balancedCurve' };
const NEUTRAL_DEFAULTS: ScaleConfig = { ...defaultConfig(), baseMode: 'balancedCurve' };

export type ScaleKey = 'primary' | 'neutral';
export type NeutralTint = 'own' | 'primary';

export interface StudioState {
  primaryAnchors: string[];
  neutralAnchors: string[];
  primaryConfig: ScaleConfig;
  neutralConfig: ScaleConfig;
  neutralTint: NeutralTint;
  dark: boolean;
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

function loadFromUrl(): Partial<StudioState> | null {
  const q = new URLSearchParams(window.location.search);
  if (!q.has('p') && !q.has('n') && !q.has('pcfg') && !q.has('ncfg') && !q.has('ppreset') && !q.has('npreset'))
    return null;
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
  if (q.has('ppreset')) state.primaryPreset = presetFromUrl(q, 'ppreset');
  if (q.has('npreset')) state.neutralPreset = presetFromUrl(q, 'npreset');
  return state;
}

function tryGenerate(anchors: string[], config: ScaleConfig): ScaleResult {
  try {
    return { scale: generateScale(anchors, config), error: null };
  } catch (e) {
    return { scale: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface StudioContextValue {
  state: StudioState;
  /**
   * Deferred copy of the state: expensive derived UI (scale generation, charts,
   * contrast matrix, exports) follows this at transition priority so urgent
   * updates (slider drags, text inputs) stay responsive.
   */
  deferredState: StudioState;
  /** deferred-derived results — recompute at transition priority */
  primaryResult: ScaleResult;
  neutralResult: ScaleResult;
  setAnchors(key: ScaleKey, anchors: string[]): void;
  setConfig(key: ScaleKey, config: ScaleConfig): void;
  setNeutralTint(tint: NeutralTint): void;
  resetScale(key: ScaleKey): void;
  /** exact-preset Tailwind family per scale; null reverts to generated scales (anchors kept) */
  applyPreset(key: ScaleKey, familyId: string | null): void;
  applyRandom(): void;
  toggleDark(): void;
  /** restore a config JSON (the Config JSON export); returns false when the text is not a valid config */
  applyConfig(text: string): boolean;
}

export interface FocusContextValue {
  /** the scale step (50–950) currently hovered within a scale — shared by strip, charts */
  focused: { key: ScaleKey; step: ScaleStepNumber } | null;
  setFocused(key: ScaleKey, step: ScaleStepNumber): void;
  clearFocused(key: ScaleKey): void;
}

const StudioContext = createContext<StudioContextValue | null>(null);
const FocusContext = createContext<FocusContextValue | null>(null);

export function StudioProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StudioState>(() => {
    const urlState = loadFromUrl();
    // no presets by default (generated scales); URL preset values win,
    // including an explicit null; anchors fall back to the active preset's
    // 500 shade so URL-only presets stay self-consistent
    const primaryPreset = urlState && 'primaryPreset' in urlState ? urlState.primaryPreset! : null;
    const neutralPreset = urlState && 'neutralPreset' in urlState ? urlState.neutralPreset! : null;
    return {
      primaryAnchors: urlState?.primaryAnchors ?? [presetAnchorHex(primaryPreset) ?? '#b766dc'],
      neutralAnchors: urlState?.neutralAnchors ?? [presetAnchorHex(neutralPreset) ?? '#a49aa8'],
      primaryConfig: urlState?.primaryConfig ?? { ...PRIMARY_DEFAULTS },
      neutralConfig: urlState?.neutralConfig ?? { ...NEUTRAL_DEFAULTS },
      neutralTint: urlState?.neutralTint ?? 'own',
      dark: urlState?.dark ?? false,
      primaryPreset,
      neutralPreset,
    };
  });

  const [focused, setFocusedState] = useState<{ key: ScaleKey; step: ScaleStepNumber } | null>(null);

  // expensive derived UI follows the deferred state at transition priority
  const deferredState = useDeferredValue(state);

  const setAnchors = useCallback((key: ScaleKey, anchors: string[]) => {
    setState((s) => ({
      ...s,
      [key === 'primary' ? 'primaryAnchors' : 'neutralAnchors']: anchors,
      [key === 'primary' ? 'primaryPreset' : 'neutralPreset']: null,
    }));
  }, []);

  const setConfig = useCallback((key: ScaleKey, config: ScaleConfig) => {
    setState((s) => ({
      ...s,
      [key === 'primary' ? 'primaryConfig' : 'neutralConfig']: config,
      [key === 'primary' ? 'primaryPreset' : 'neutralPreset']: null,
    }));
  }, []);

  const setNeutralTint = useCallback((tint: NeutralTint) => {
    setState((s) => ({ ...s, neutralTint: tint, neutralPreset: null }));
  }, []);

  const resetScale = useCallback((key: ScaleKey) => {
    setState((s) => ({
      ...s,
      [key === 'primary' ? 'primaryConfig' : 'neutralConfig']:
        key === 'primary' ? { ...PRIMARY_DEFAULTS } : { ...NEUTRAL_DEFAULTS },
      [key === 'primary' ? 'primaryPreset' : 'neutralPreset']: null,
    }));
  }, []);

  const applyPreset = useCallback((key: ScaleKey, familyId: string | null) => {
    setState((s) => {
      if (familyId === null) {
        return { ...s, [key === 'primary' ? 'primaryPreset' : 'neutralPreset']: null };
      }
      const family = familyById(familyId);
      if (!family) return s;
      const anchorHex = family.shades.find((shade) => shade.number === 500)!.hex;
      return {
        ...s,
        [key === 'primary' ? 'primaryAnchors' : 'neutralAnchors']: [anchorHex],
        [key === 'primary' ? 'primaryPreset' : 'neutralPreset']: familyId,
      };
    });
  }, []);

  const applyRandom = useCallback(() => {
    setState((s) => {
      const hue = Math.floor(Math.random() * 360);
      const sat = 0.55 + Math.random() * 0.35;
      const light = 0.5 + Math.random() * 0.2;
      return {
        ...s,
        primaryAnchors: [culoriFormatHex({ mode: 'hsl', h: hue, s: sat, l: light }) ?? '#888888'],
        neutralAnchors: [culoriFormatHex({ mode: 'hsl', h: hue, s: sat * 0.12, l: light }) ?? '#888888'],
        primaryPreset: null,
        neutralPreset: null,
      };
    });
  }, []);

  const toggleDark = useCallback(() => {
    setState((s) => ({ ...s, dark: !s.dark }));
  }, []);

  const applyConfig = useCallback((text: string): boolean => {
    const parsed = parseConfigJson(text);
    if (!parsed) return false;
    setState((s) => ({ ...s, ...parsed }));
    return true;
  }, []);

  const setFocused = useCallback((key: ScaleKey, step: ScaleStepNumber) => {
    setFocusedState({ key, step });
  }, []);

  const clearFocused = useCallback((key: ScaleKey) => {
    setFocusedState((current) => (current?.key === key ? null : current));
  }, []);

  const primaryResult = useMemo<ScaleResult>(() => {
    if (deferredState.primaryPreset) {
      const family = familyById(deferredState.primaryPreset);
      if (family) return { scale: scaleFromFamily(family), error: null };
    }
    return tryGenerate(deferredState.primaryAnchors, deferredState.primaryConfig);
  }, [deferredState.primaryAnchors, deferredState.primaryConfig, deferredState.primaryPreset]);

  const neutralResult = useMemo<ScaleResult>(() => {
    if (deferredState.neutralPreset) {
      const family = familyById(deferredState.neutralPreset);
      if (family) return { scale: scaleFromFamily(family), error: null };
    }
    let config = deferredState.neutralConfig;
    // tint only applies to single-anchor scales (carve-out)
    if (deferredState.neutralTint === 'primary' && deferredState.neutralAnchors.length === 1) {
      const primaryHue = oklchOf(deferredState.primaryAnchors[0]!).h;
      if (Number.isFinite(primaryHue)) {
        config = { ...config, hue: { ...config.hue, tint: primaryHue } };
      }
    }
    return tryGenerate(deferredState.neutralAnchors, config);
  }, [
    deferredState.neutralAnchors,
    deferredState.neutralConfig,
    deferredState.neutralPreset,
    deferredState.neutralTint,
    deferredState.primaryAnchors,
  ]);

  // ---- dark mode -----------------------------------------------------------------
  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.dark);
  }, [state.dark]);

  // ---- URL sync ------------------------------------------------------------------
  const firstSync = useRef(true);
  useEffect(() => {
    if (firstSync.current) {
      firstSync.current = false;
      return;
    }
    const timer = setTimeout(() => {
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
      window.history.replaceState(null, '', `${window.location.pathname}?${q.toString()}`);
    }, 300);
    return () => clearTimeout(timer);
  }, [state]);

  const studioValue = useMemo<StudioContextValue>(
    () => ({
      state,
      deferredState,
      primaryResult,
      neutralResult,
      setAnchors,
      setConfig,
      setNeutralTint,
      resetScale,
      applyPreset,
      applyRandom,
      toggleDark,
      applyConfig,
    }),
    [state, deferredState, primaryResult, neutralResult, setAnchors, setConfig, setNeutralTint, resetScale, applyPreset, applyRandom, toggleDark, applyConfig],
  );

  const focusValue = useMemo<FocusContextValue>(
    () => ({ focused, setFocused, clearFocused }),
    [focused, setFocused, clearFocused],
  );

  return (
    <StudioContext.Provider value={studioValue}>
      <FocusContext.Provider value={focusValue}>{children}</FocusContext.Provider>
    </StudioContext.Provider>
  );
}

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStudio must be used within a StudioProvider');
  return ctx;
}

export function useFocus(): FocusContextValue {
  const ctx = useContext(FocusContext);
  if (!ctx) throw new Error('useFocus must be used within a StudioProvider');
  return ctx;
}

/** The Tailwind families available as presets, in engine order. */
export const PRESET_FAMILIES = TAILWIND_FAMILIES;
