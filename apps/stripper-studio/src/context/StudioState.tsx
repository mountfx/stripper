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
  familyById,
  TAILWIND_FAMILIES,
  type ScaleConfig,
  type ScaleStepNumber,
} from 'stripper';
import { formatHex as culoriFormatHex } from 'culori';
import { MAX_ANCHORS, parseConfigJson } from '@/lib/configExport';
import {
  DEFAULTS,
  generateNeutral,
  generatePrimary,
  paramsFromState,
  stateFromParams,
  type NeutralTint,
  type ScaleResult,
} from '@/lib/themeFromParams';

export { MAX_ANCHORS };
export type { NeutralTint };

export type ScaleKey = 'primary' | 'neutral';

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

export interface StudioContextValue {
  state: StudioState;
  /**
   * Deferred copy of the state: expensive derived UI (scale generation, charts,
   * contrast matrix, exports) follows this at transition priority so urgent
   * updates (slider drags, hex inputs) stay instant.
   */
  deferredState: StudioState;
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
  /** the scale step (50–950) currently hovered within a scale — shared by strip and charts */
  focused: { key: ScaleKey; step: ScaleStepNumber } | null;
  setFocused(key: ScaleKey, step: ScaleStepNumber): void;
  clearFocused(key: ScaleKey): void;
}

const StudioContext = createContext<StudioContextValue | null>(null);
const FocusContext = createContext<FocusContextValue | null>(null);

export function StudioProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StudioState>(() => {
    const q = new URLSearchParams(window.location.search);
    const params = stateFromParams(q);
    return { ...params, dark: q.get('dark') === '1' };
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
      [key === 'primary' ? 'primaryConfig' : 'neutralConfig']: { ...DEFAULTS },
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

  const primaryResult = useMemo<ScaleResult>(
    () =>
      generatePrimary({
        preset: deferredState.primaryPreset,
        anchors: deferredState.primaryAnchors,
        config: deferredState.primaryConfig,
      }),
    [deferredState.primaryPreset, deferredState.primaryAnchors, deferredState.primaryConfig],
  );

  const neutralResult = useMemo<ScaleResult>(
    () =>
      generateNeutral({
        preset: deferredState.neutralPreset,
        anchors: deferredState.neutralAnchors,
        config: deferredState.neutralConfig,
        tint: deferredState.neutralTint,
        primaryAnchors: deferredState.primaryAnchors,
      }),
    [
      deferredState.neutralPreset,
      deferredState.neutralAnchors,
      deferredState.neutralConfig,
      deferredState.neutralTint,
      deferredState.primaryAnchors,
    ],
  );

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
      const q = paramsFromState(state);
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
