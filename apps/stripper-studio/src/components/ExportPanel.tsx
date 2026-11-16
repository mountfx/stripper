import { useMemo, useState } from 'react';
import { toThemeCss, toJson, toSwiftUi, toKotlin, type ThemeScales } from 'stripper';
import { useStudio } from '@/context/StudioState';
import { useClipboard } from '@/hooks/useClipboard';
import { buildConfigJson } from '@/lib/configExport';
import { Button } from '@/components/ui/button';
import { TabsRoot, TabsIndicator, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs';

type Tab = 'css' | 'json' | 'swift' | 'kotlin' | 'config';

const TABS: Array<{ value: Tab; label: string; file: string; mime: string }> = [
  { value: 'css', label: '@theme CSS', file: 'theme.css', mime: 'text/css' },
  { value: 'json', label: 'JSON', file: 'tokens.json', mime: 'application/json' },
  { value: 'swift', label: 'SwiftUI', file: 'Colors.swift', mime: 'text/plain' },
  { value: 'kotlin', label: 'Kotlin', file: 'Colors.kt', mime: 'text/plain' },
  { value: 'config', label: 'Config JSON', file: 'config.json', mime: 'application/json' },
];

export function ExportPanel({ scales }: { scales: ThemeScales }) {
  const { deferredState } = useStudio();
  const { copyText, lastCopied } = useClipboard();
  const [tab, setTab] = useState<Tab>('css');

  const meta = TABS.find((t) => t.value === tab)!;

  // each tab owns its snippet; copy/download always operate on the active tab's
  const contents = useMemo<Record<Tab, string>>(
    () => ({
      css: toThemeCss(scales),
      json: toJson(scales),
      swift: toSwiftUi(scales),
      kotlin: toKotlin(scales),
      config: buildConfigJson({
        preset: { primary: deferredState.primaryPreset, neutral: deferredState.neutralPreset },
        primary: { anchors: deferredState.primaryAnchors, config: deferredState.primaryConfig },
        neutral: { anchors: deferredState.neutralAnchors, config: deferredState.neutralConfig, tint: deferredState.neutralTint },
      }),
    }),
    [scales, deferredState],
  );

  function download() {
    const blob = new Blob([contents[tab]], { type: meta.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = meta.file;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="overflow-hidden border border-border bg-card">
      <TabsRoot value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 pt-2">
          <TabsList>
            {TABS.map((t) => (
              <TabsTab key={t.value} value={t.value} className="text-xs">
                {t.label}
              </TabsTab>
            ))}
            <TabsIndicator />
          </TabsList>
          <div className="ml-auto flex items-center gap-2 pb-2">
            {lastCopied && <span className="text-[10px] text-muted-foreground">copied</span>}
            <Button variant="outline" size="sm" onClick={() => copyText(contents[tab])}>
              Copy
            </Button>
            <Button variant="outline" size="sm" onClick={download}>
              Download
            </Button>
          </div>
        </div>
        {TABS.map((t) => (
          <TabsPanel key={t.value} value={t.value}>
            <pre className="max-h-72 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {contents[t.value]}
            </pre>
          </TabsPanel>
        ))}
      </TabsRoot>
    </div>
  );
}
