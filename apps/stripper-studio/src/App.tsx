import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { type ThemeScales } from '@mountfx/stripper';
import { useStudio, type ColorScheme } from '@/context/StudioState';
import { paramsFromState } from '@/lib/themeFromParams';
import { useClipboard } from '@/hooks/useClipboard';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ConfigPanel } from '@/components/ConfigPanel';
import { ExportPanel } from '@/components/ExportPanel';
import { ScaleSection } from '@/components/ScaleSection';
import { PlusIcon, ShuffleIcon, TrashIcon } from '@/components/ui/icons';

/**
 * Local editing state for the scheme name: commits on blur/Enter so the
 * fallback/dedupe renames never fight the user mid-typing.
 */
function SchemeNameInput({ scheme, index, onRename }: { scheme: ColorScheme; index: number; onRename(id: string, name: string): void }) {
  const [value, setValue] = useState(scheme.name);
  const [prevName, setPrevName] = useState(scheme.name);
  // resync when the name changes externally (dedupe suffix, config load) —
  // the React-endorsed "adjust state during render" pattern
  if (prevName !== scheme.name) {
    setPrevName(scheme.name);
    setValue(scheme.name);
  }
  const commit = () => {
    if (value.trim() !== scheme.name) onRename(scheme.id, value);
  };
  return (
    <Input
      value={value}
      aria-label={`Scheme ${index + 1} name`}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className="h-7 border-transparent bg-transparent px-2 text-xs font-semibold shadow-none focus-visible:border-border"
    />
  );
}

function Studio() {
  const {
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
  } = useStudio();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loadError, setLoadError] = useState(false);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { copyText, lastCopied } = useClipboard();

  /** The /api/colors link for the CURRENT state — fresh even before the debounced URL sync. */
  const apiLink = useMemo(() => {
    const q = paramsFromState({ schemes: state.schemes });
    q.delete('dark'); // UI chrome — the endpoint ignores it anyway
    return `${window.location.origin}/api/colors?${q.toString()}`;
  }, [state.schemes]);

  async function onConfigFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-loading the same file
    if (!file) return;
    const ok = applyConfig(await file.text());
    if (ok) {
      setLoadError(false);
    } else {
      setLoadError(true);
      clearTimeout(errorTimer.current);
      errorTimer.current = setTimeout(() => setLoadError(false), 2500);
    }
  }

  const scales = useMemo<ThemeScales>(() => {
    const out: ThemeScales = [];
    deferredState.schemes.forEach((scheme, i) => {
      const scale = results[i]?.result.scale;
      if (scale) out.push({ name: scheme.name, scale });
    });
    return out;
  }, [deferredState.schemes, results]);

  /** mid steps of the first schemes for the header swatch */
  const swatchColors = useMemo(() => {
    const mid = (i: number, step: string) =>
      results[i]?.result.scale?.steps.find((s) => s.number === Number(step))?.hex ?? '#888888';
    return { a: mid(0, '500'), b: mid(1, '400') };
  }, [results]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className="h-4 w-4 border border-border"
              style={{ background: `linear-gradient(135deg, ${swatchColors.a} 50%, ${swatchColors.b} 50%)` }}
            />
            <h1 className="text-sm font-semibold tracking-tight">Stripper Studio</h1>
            <span className="text-[10px] text-muted-foreground">design tokens</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {loadError && <span className="text-[10px] text-destructive">invalid config file</span>}
            <Button
              variant="outline"
              size="sm"
              title="Load a config JSON (the Config JSON export) and apply it to the color schemes"
              onClick={() => fileInputRef.current?.click()}
            >
              Load config
            </Button>
            <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={onConfigFile} />
            <Button
              variant="outline"
              size="sm"
              title="Copy the /api/colors link for the current color schemes"
              onClick={() => copyText(apiLink)}
            >
              {lastCopied ? 'Copied!' : 'Copy API link'}
            </Button>
            <Button variant="ghost" size="sm" onClick={toggleDark}>
              {state.dark ? 'Light' : 'Dark'}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-6">
          {state.schemes.map((scheme, i) => (
            <section key={scheme.id} className="border border-border bg-card">
              <div className="flex items-center gap-1 border-b border-border px-2 py-2">
                <SchemeNameInput scheme={scheme} index={i} onRename={renameScheme} />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 shrink-0 px-0 text-muted-foreground"
                  title={`Random brand color for ${scheme.name}`}
                  onClick={() => randomScheme(scheme.id)}
                >
                  <ShuffleIcon className="size-3.5" />
                </Button>
                {state.schemes.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 shrink-0 px-0 text-muted-foreground"
                    title={`Delete scheme ${scheme.name}`}
                    onClick={() => removeScheme(scheme.id)}
                  >
                    <TrashIcon className="size-3.5" />
                  </Button>
                )}
              </div>
              <div className="px-4 py-4">
                <ConfigPanel
                  schemeId={scheme.id}
                  anchors={scheme.anchors}
                  config={scheme.config}
                  preset={scheme.preset}
                  onAnchorsChange={(anchors) => setAnchors(scheme.id, anchors)}
                  onConfigChange={(config) => setConfig(scheme.id, config)}
                  onPresetChange={(familyId) => applyPreset(scheme.id, familyId)}
                  onReset={() => resetScale(scheme.id)}
                />
              </div>
            </section>
          ))}
          <Button variant="outline" size="sm" className="w-full" onClick={addScheme}>
            <PlusIcon className="size-3.5" /> Add scheme
          </Button>
        </aside>

        <main className="min-w-0 space-y-10">
          {state.schemes.map((scheme, i) => (
            <div key={scheme.id} className="contents">
              {i > 0 && <Separator className="mb-10" />}
              <ScaleSection
                schemeId={scheme.id}
                title={scheme.name}
                scale={results[i]?.result.scale ?? null}
                error={results[i]?.result.error ?? null}
                preset={scheme.preset}
              />
            </div>
          ))}

          {/* Export */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Export</h2>
            <ExportPanel scales={scales} />
            <p className="text-[11px] text-muted-foreground">
              Tailwind v4 <code className="font-mono">@theme</code> tokens. Import into the app CSS:{' '}
              <code className="font-mono">@import "tailwindcss"; {'@theme { --color-<scheme>-500: …; }'}</code> Also
              exports SwiftUI and Jetpack Compose color tokens, plus the applied scheme configuration as JSON.
            </p>
          </section>

          <footer className="pb-8 text-[11px] leading-relaxed text-muted-foreground">
            Contrast values are APCA Lc (0.0.98G-4g). Positive = dark text on light background, negative = light text on
            dark background. Level chips follow the APCA Readability Criterion: 90 preferred body · 75 body · 60 content
            · 45 large · 30 headlines · 15 spot/non-text. Consistent-contrast mode re-solves each step's lightness
            against the fixed target ladder (same principle as uicolors' generator of the same name).
          </footer>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <TooltipProvider delay={150}>
      <Studio />
    </TooltipProvider>
  );
}
