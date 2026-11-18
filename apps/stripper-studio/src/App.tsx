import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { type ThemeScales } from 'stripper';
import { useStudio } from '@/context/StudioState';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ConfigPanel } from '@/components/ConfigPanel';
import { ExportPanel } from '@/components/ExportPanel';
import { ScaleSection } from '@/components/ScaleSection';

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-xs font-semibold tracking-wider text-foreground uppercase">{title}</h2>
      </div>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

function Studio() {
  const {
    state,
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
  } = useStudio();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loadError, setLoadError] = useState(false);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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
    if (primaryResult.scale) out.push({ name: 'primary', scale: primaryResult.scale });
    if (neutralResult.scale) out.push({ name: 'neutral', scale: neutralResult.scale });
    return out;
  }, [primaryResult.scale, neutralResult.scale]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className="h-4 w-4 border border-border"
              style={{
                background: 'linear-gradient(135deg, var(--color-primary-500) 50%, var(--color-neutral-400) 50%)',
              }}
            />
            <h1 className="text-sm font-semibold tracking-tight">Stripper Studio</h1>
            <span className="text-[10px] text-muted-foreground">design tokens</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {loadError && <span className="text-[10px] text-destructive">invalid config file</span>}
            <Button variant="outline" size="sm" onClick={applyRandom}>
              Random
            </Button>
            <Button
              variant="outline"
              size="sm"
              title="Load a config JSON (the Config JSON export) and apply it to both scales"
              onClick={() => fileInputRef.current?.click()}
            >
              Load config
            </Button>
            <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={onConfigFile} />
            <Button variant="ghost" size="sm" onClick={toggleDark}>
              {state.dark ? 'Light' : 'Dark'}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <PanelSection title="Primary scale">
            <ConfigPanel
              role="primary"
              anchors={state.primaryAnchors}
              config={state.primaryConfig}
              preset={state.primaryPreset}
              onAnchorsChange={(anchors) => setAnchors('primary', anchors)}
              onConfigChange={(config) => setConfig('primary', config)}
              onPresetChange={(familyId) => applyPreset('primary', familyId)}
              onReset={() => resetScale('primary')}
            />
          </PanelSection>
          <PanelSection title="Neutral scale">
            <ConfigPanel
              role="neutral"
              anchors={state.neutralAnchors}
              config={state.neutralConfig}
              preset={state.neutralPreset}
              neutralTint={state.neutralTint}
              onAnchorsChange={(anchors) => setAnchors('neutral', anchors)}
              onConfigChange={(config) => setConfig('neutral', config)}
              onNeutralTintChange={(tint) => setNeutralTint(tint)}
              onPresetChange={(familyId) => applyPreset('neutral', familyId)}
              onReset={() => resetScale('neutral')}
            />
          </PanelSection>
        </aside>

        <main className="min-w-0 space-y-10">
          {/* Primary */}
          <ScaleSection
            role="primary"
            title="primary"
            scale={primaryResult.scale}
            error={primaryResult.error}
            preset={state.primaryPreset}
            contrastMode={state.primaryConfig.contrastMode}
          />
          <Separator />
          {/* Neutral */}
          <ScaleSection
            role="neutral"
            title="neutral"
            scale={neutralResult.scale}
            error={neutralResult.error}
            preset={state.neutralPreset}
            contrastMode={state.neutralConfig.contrastMode}
          />

          {/* Export */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Export</h2>
            <ExportPanel scales={scales} />
            <p className="text-[11px] text-muted-foreground">
              Tailwind v4 <code className="font-mono">@theme</code> tokens. Import into the app CSS:{' '}
              <code className="font-mono">@import "tailwindcss"; {'@theme { --color-primary-500: …; }'}</code> Also
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
