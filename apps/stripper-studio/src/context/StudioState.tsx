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
} from '@mountfx/stripper';
import { formatHex as culoriFormatHex } from 'culori';
import { MAX_ANCHORS, parseConfigJson, type SchemeConfigExport } from '@/lib/configExport';
import {
  DEFAULTS,
  cleanSchemeName,
  generateScheme,
  paramsFromState,
  sanitizeName,
  stateFromParams,
  type ScaleResult,
  type SchemeParams,
} from '@/lib/themeFromParams';

export { MAX_ANCHORS };

/** A color scheme in studio state: identity + live editing fields. */
export interface ColorScheme extends SchemeConfigExport {
  /** stable identity for React keys and focus tracking (not user-visible) */
  id: string;
}

export interface StudioState {
  dark: boolean;
  schemes: ColorScheme[];
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `s-${Date.now().toString(36)}-${idCounter}`;
}

function toScheme(scheme: SchemeParams): ColorScheme {
  return { id: nextId(), ...scheme };
}

export interface StudioContextValue {
  state: StudioState;
  /**
   * Deferred copy of the state: expensive derived UI (scale generation, charts,
   * contrast matrix, exports) follows this at transition priority so urgent
   * updates (slider drags, hex inputs) stay instant.
   */
  deferredState: StudioState;
  /** one generation result per scheme, same order as `state.schemes` */
  results: Array<{ id: string; result: ScaleResult }>;
  renameScheme(id: string, name: string): void;
  setAnchors(id: string, anchors: string[]): void;
  setConfig(id: string, config: ScaleConfig): void;
  resetScale(id: string): void;
  /** exact-preset Tailwind family per scheme; null reverts to generated (anchors kept) */
  applyPreset(id: string, familyId: string | null): void;
  /** random brand color for one scheme (preset cleared) */
  randomScheme(id: string): void;
  addScheme(): void;
  /** delete a scheme; the last remaining scheme is never removed */
  removeScheme(id: string): void;
  toggleDark(): void;
  /** restore a config JSON (the Config JSON export); returns false when the text is not a valid config */
  applyConfig(text: string): boolean;
}

export interface FocusContextValue {
  /** the scheme + scale step (50–950) currently hovered — shared by strip and charts */
  focused: { id: string; step: ScaleStepNumber } | null;
  setFocused(id: string, step: ScaleStepNumber): void;
  clearFocused(id: string): void;
}

const StudioContext = createContext<StudioContextValue | null>(null);
const FocusContext = createContext<FocusContextValue | null>(null);

function patchScheme(schemes: ColorScheme[], id: string, patch: Partial<ColorScheme>): ColorScheme[] {
  return schemes.map((scheme) => (scheme.id === id ? { ...scheme, ...patch } : scheme));
}

export function StudioProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StudioState>(() => {
    const q = new URLSearchParams(window.location.search);
    const params = stateFromParams(q);
    return { schemes: params.schemes.map(toScheme), dark: q.get('dark') === '1' };
  });

  const [focused, setFocusedState] = useState<{ id: string; step: ScaleStepNumber } | null>(null);

  // expensive derived UI follows the deferred state at transition priority
  const deferredState = useDeferredValue(state);

  const renameScheme = useCallback((id: string, name: string) => {
    setState((s) => {
      const taken = new Set(s.schemes.filter((scheme) => scheme.id !== id).map((scheme) => scheme.name));
      const base = cleanSchemeName(name);
      if (!base) {
        // empty name: first free schemeN
        let k = 1;
        while (taken.has(`scheme${k}`)) k++;
        return { ...s, schemes: patchScheme(s.schemes, id, { name: `scheme${k}` }) };
      }
      let unique = base;
      let n = 2;
      while (taken.has(unique)) unique = `${base}-${n++}`;
      return { ...s, schemes: patchScheme(s.schemes, id, { name: unique }) };
    });
  }, []);

  const setAnchors = useCallback((id: string, anchors: string[]) => {
    setState((s) => ({ ...s, schemes: patchScheme(s.schemes, id, { anchors, preset: null }) }));
  }, []);

  const setConfig = useCallback((id: string, config: ScaleConfig) => {
    setState((s) => ({ ...s, schemes: patchScheme(s.schemes, id, { config, preset: null }) }));
  }, []);

  const resetScale = useCallback((id: string) => {
    setState((s) => ({ ...s, schemes: patchScheme(s.schemes, id, { config: { ...DEFAULTS }, preset: null }) }));
  }, []);

  const applyPreset = useCallback((id: string, familyId: string | null) => {
    setState((s) => {
      if (familyId === null) {
        return { ...s, schemes: patchScheme(s.schemes, id, { preset: null }) };
      }
      const family = familyById(familyId);
      if (!family) return s;
      const anchorHex = family.shades.find((shade) => shade.number === 500)!.hex;
      return { ...s, schemes: patchScheme(s.schemes, id, { anchors: [anchorHex], preset: familyId }) };
    });
  }, []);

  const randomScheme = useCallback((id: string) => {
    setState((s) => {
      const hue = Math.floor(Math.random() * 360);
      const sat = 0.55 + Math.random() * 0.35;
      const light = 0.5 + Math.random() * 0.2;
      const hex = culoriFormatHex({ mode: 'hsl', h: hue, s: sat, l: light }) ?? '#888888';
      return { ...s, schemes: patchScheme(s.schemes, id, { anchors: [hex], preset: null }) };
    });
  }, []);

  const addScheme = useCallback(() => {
    setState((s) => {
      const index = s.schemes.length;
      const name = sanitizeName(null, index);
      let unique = name;
      const taken = new Set(s.schemes.map((scheme) => scheme.name));
      let n = 2;
      while (taken.has(unique)) unique = `${name}-${n++}`;
      return {
        ...s,
        schemes: [...s.schemes, { id: nextId(), name: unique, anchors: ['#888888'], config: { ...DEFAULTS }, preset: null }],
      };
    });
  }, []);

  const removeScheme = useCallback((id: string) => {
    setState((s) => {
      if (s.schemes.length <= 1) return s;
      return { ...s, schemes: s.schemes.filter((scheme) => scheme.id !== id) };
    });
  }, []);

  const toggleDark = useCallback(() => {
    setState((s) => ({ ...s, dark: !s.dark }));
  }, []);

  const applyConfig = useCallback((text: string): boolean => {
    const parsed = parseConfigJson(text);
    if (!parsed) return false;
    setState((s) => ({ ...s, schemes: parsed.schemes.map(toScheme) }));
    return true;
  }, []);

  const setFocused = useCallback((id: string, step: ScaleStepNumber) => {
    setFocusedState({ id, step });
  }, []);

  const clearFocused = useCallback((id: string) => {
    setFocusedState((current) => (current?.id === id ? null : current));
  }, []);

  const results = useMemo<Array<{ id: string; result: ScaleResult }>>(
    () =>
      deferredState.schemes.map((scheme) => ({
        id: scheme.id,
        result: generateScheme({ preset: scheme.preset, anchors: scheme.anchors, config: scheme.config }),
      })),
    [deferredState],
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
      const q = paramsFromState({ schemes: state.schemes, dark: state.dark });
      window.history.replaceState(null, '', `${window.location.pathname}?${q.toString()}`);
    }, 300);
    return () => clearTimeout(timer);
  }, [state]);

  const studioValue = useMemo<StudioContextValue>(
    () => ({
      state,
      deferredState,
      results,
      renameScheme,
      setAnchors,
      setConfig,
      resetScale,
      applyPreset,
      randomScheme,
      addScheme,
      removeScheme,
      toggleDark,
      applyConfig,
    }),
    [state, deferredState, results, renameScheme, setAnchors, setConfig, resetScale, applyPreset, randomScheme, addScheme, removeScheme, toggleDark, applyConfig],
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
