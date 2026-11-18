import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { ScaleStepNumber } from 'stripper';
import App from '../src/App';
import { StudioProvider, useStudio, useFocus, migrateLegacyConfig } from '../src/context/StudioState';
import { buildConfigJson, parseConfigJson } from '../src/lib/configExport';
import { defaultConfig, type Scale } from 'stripper';

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

/** Renders the studio state + results as JSON for test assertions. */
function Probe() {
  const studio = useStudio();
  const { focused } = useFocus();
  const summarize = (result: { scale: Scale | null }) =>
    result.scale
      ? {
          anchorStep: result.scale.anchorStep,
          anchors: result.scale.anchors,
          hexes: Object.fromEntries(result.scale.steps.map((s) => [s.number, s.hex])),
          kept: Object.fromEntries(result.scale.steps.map((s) => [s.number, s.kept ?? false])),
        }
      : null;
  return (
    <pre data-testid="studio-probe" className="hidden">
      {JSON.stringify({
        state: studio.state,
        focused,
        primaryScale: summarize(studio.primaryResult),
        neutralScale: summarize(studio.neutralResult),
      })}
    </pre>
  );
}

function renderApp(url?: string) {
  if (url) window.history.replaceState(null, '', url);
  return render(
    <StudioProvider>
      <App />
      <Probe />
    </StudioProvider>,
  );
}

function probe(): {
  state: {
    primaryAnchors: string[];
    neutralAnchors: string[];
    primaryConfig: { keepAnchorsExact?: boolean; contrastMode: string };
    neutralConfig: { contrastMode: string };
    neutralTint: string;
    dark: boolean;
    primaryPreset: string | null;
    neutralPreset: string | null;
  };
  focused: { key: string; step: ScaleStepNumber } | null;
  primaryScale: { anchorStep: number; anchors: Array<{ step: number; hex: string }>; hexes: Record<string, string>; kept: Record<string, boolean> } | null;
  neutralScale: unknown;
} {
  return JSON.parse(screen.getByTestId('studio-probe').textContent!);
}

function swatches(): HTMLElement[] {
  return Array.from(document.querySelectorAll('.group')) as HTMLElement[];
}

/** Test-only: exposes applyConfig through a button, reporting 'ok'/'fail'. */
function ApplyConfigProbe({ json }: { json: string }) {
  const { applyConfig } = useStudio();
  const [result, setResult] = useState<string | null>(null);
  return (
    <>
      <button
        data-testid="apply-config"
        onClick={() => setResult(applyConfig(json) ? 'ok' : 'fail')}
      >
        apply
      </button>
      {result && <span data-testid="apply-result">{result}</span>}
    </>
  );
}

describe('studio App', () => {
  it('mounts without runtime errors', () => {
    const { container } = renderApp();
    expect(container.firstElementChild).not.toBeNull();
  });

  it('renders exact Tailwind preset strips by default and 11 swatches per scale', () => {
    renderApp();
    expect(screen.getByText('primary')).toBeTruthy();
    expect(screen.getByText('neutral')).toBeTruthy();
    // per-scale exact preset badges
    expect(screen.getByText('Violet preset (exact)')).toBeTruthy();
    expect(screen.getByText('Zinc preset (exact)')).toBeTruthy();
    // both strips render 11 swatches each
    expect(swatches()).toHaveLength(22);
    // the exact preset hexes are shown (violet-500 / zinc-500)
    expect(document.body.innerHTML).toContain('#8b5cf6');
    expect(document.body.innerHTML).toContain('#71717a');
  });

  it('renders the export panel with @theme output', () => {
    renderApp();
    const css = screen.getByText(/--color-primary-500: oklch/);
    expect(css.textContent).toContain('@theme {');
  });

  it('selecting a preset shows the exact Tailwind family scale', async () => {
    const user = userEvent.setup();
    renderApp('?ppreset=blue');
    // blue preset active on load
    expect(probe().state.primaryPreset).toBe('blue');
    expect(probe().primaryScale!.hexes['500']).toBe('#3b82f6');
    expect(probe().primaryScale!.hexes['950']).toBe('#172554');

    // switch to red via the preset select
    const trigger = screen.getAllByRole('combobox', { name: 'Preset' })[0]!;
    await user.click(trigger);
    await user.click(await screen.findByRole('option', { name: 'Red' }));
    expect(probe().state.primaryPreset).toBe('red');
    expect(probe().primaryScale!.hexes['500']).toBe('#ef4444');
    // picking a preset also resets the anchors to the family's 500 shade
    expect(probe().state.primaryAnchors).toEqual(['#ef4444']);
  });

  it('switching back to Custom keeps the anchors and generates from them', async () => {
    const user = userEvent.setup();
    renderApp('?ppreset=blue');
    const trigger = screen.getAllByRole('combobox', { name: 'Preset' })[0]!;
    await user.click(trigger);
    await user.click(await screen.findByRole('option', { name: 'Custom' }));
    expect(probe().state.primaryPreset).toBeNull();
    expect(probe().state.primaryAnchors).toEqual(['#3b82f6']);
    // generated scale (ladder-solved lightness) — no longer the exact family table
    const scale = probe().primaryScale!;
    expect(Object.keys(scale.hexes)).toHaveLength(11);
    expect(scale.hexes['500']).not.toBe('#3b82f6');
    expect(scale.hexes['950']).not.toBe('#172554');
  });

  it('any edit to a scale clears only that scale’s preset', async () => {
    const user = userEvent.setup();
    renderApp();
    expect(probe().state.primaryPreset).toBe('violet');
    expect(probe().state.neutralPreset).toBe('zinc');

    // edit the primary brand color hex (the picker's field reads on Enter)
    const hexInput = screen.getAllByRole('textbox')[0]!; // first primary anchor hex field
    await user.clear(hexInput);
    await user.keyboard('#ef4444');
    await user.keyboard('{Enter}');
    expect(probe().state.primaryAnchors).toEqual(['#ef4444']);
    expect(probe().state.primaryPreset).toBeNull();
    expect(probe().state.neutralPreset).toBe('zinc');
  });

  it('clicking a swatch copies its hex', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(swatches()[0]!);
    expect(await screen.findByText('copied')).toBeTruthy();
  });

  it('hovering a swatch focuses that step only within its own scale', async () => {
    const user = userEvent.setup();
    renderApp();
    const primarySwatches = swatches().slice(0, 11);
    const neutralSwatches = swatches().slice(11, 22);

    await user.hover(primarySwatches[2]!);
    expect(probe().focused).toEqual({ key: 'primary', step: 200 });
    // the focused swatch expands
    expect(primarySwatches[2]!.className).toContain('flex-[1.4]');

    // hovering the neutral strip takes over its own focus
    await user.hover(neutralSwatches[5]!);
    expect(probe().focused).toEqual({ key: 'neutral', step: 500 });

    // leaving neutral clears only neutral
    await user.unhover(neutralSwatches[5]!);
    expect(probe().focused).toBeNull();
  });

  it('migrates legacy consistentContrast boolean configs to contrastMode', () => {
    expect(migrateLegacyConfig({ consistentContrast: true })).toEqual({ contrastMode: 'apca' });
    expect(migrateLegacyConfig({ consistentContrast: false })).toEqual({ contrastMode: 'none' });
    expect(migrateLegacyConfig({ contrastMode: 'wcag' })).toEqual({ contrastMode: 'wcag' });
    expect(migrateLegacyConfig({ hue: { driftLight: 5, driftDark: 0 } })).toEqual({ hue: { driftLight: 5, driftDark: 0 } });
  });

  it('supports multiple brand colors per scale (multi-anchor)', async () => {
    const user = userEvent.setup();
    renderApp();
    // add a second brand color to the primary scale
    await user.click(screen.getAllByText('+ Add brand color')[0]!);
    expect(probe().state.primaryAnchors).toEqual(['#8b5cf6', '#888888']);
    // preset cleared by the edit
    expect(probe().state.primaryPreset).toBeNull();
    // both anchor steps get pin markers (primary strip; neutral preset keeps its own)
    const primaryPins = document.querySelectorAll('.flex.h-24')[0]!.querySelectorAll('span[title="brand color anchored here"]');
    expect(primaryPins.length).toBe(2);
    // removing the second color restores a single-anchor scale
    const removeButtons = screen.getAllByTitle(/^Remove brand color/);
    expect(removeButtons).toHaveLength(2);
    await user.click(removeButtons[1]!);
    expect(probe().state.primaryAnchors).toEqual(['#8b5cf6']);
  });

  it('parses multi-anchor and preset URL params', () => {
    renderApp('?p=%23895af6&p2=%2314b8a6&n=%23798680&n2=%23f1f3f3&npreset=stone');
    const p = probe();
    expect(p.state.primaryAnchors).toEqual(['#895af6', '#14b8a6']);
    expect(p.state.neutralAnchors).toEqual(['#798680', '#f1f3f3']);
    expect(p.state.primaryPreset).toBe('violet'); // default, no ppreset param
    expect(p.state.neutralPreset).toBe('stone');
  });

  it('ignores unknown preset ids', () => {
    renderApp('?ppreset=not-a-family');
    const p = probe();
    expect(p.state.primaryPreset).toBeNull();
    expect(p.state.neutralPreset).toBe('zinc');
  });

  it('keep brand colors exact: checkbox drives config and anchors stay byte-exact', async () => {
    const user = userEvent.setup();
    renderApp();
    // apca contrast on by default for the primary scale; flag off
    expect(probe().state.primaryConfig.keepAnchorsExact).toBeFalsy();
    const checkbox = screen.getByRole('checkbox', { name: 'Keep brand colors exact' });
    await user.click(checkbox);
    expect(probe().state.primaryConfig.keepAnchorsExact).toBe(true);
    // anchor steps keep the input hexes exactly
    const scale = probe().primaryScale!;
    for (const anchor of scale.anchors) {
      expect(scale.hexes[String(anchor.step)]).toBe(anchor.hex);
      expect(scale.kept[String(anchor.step)]).toBe(true);
    }
  });

  it('always marks the anchored color in the scale strip', () => {
    renderApp();
    const pins = document.querySelectorAll('span[title="brand color anchored here"]');
    expect(pins.length).toBe(2); // one per scale
  });

  it('scale strip is a horizontal row of full-width swatches above the matrix', () => {
    renderApp();
    const strip = document.querySelector('.flex.h-24')!;
    expect(strip).not.toBeNull();
    const swatch = strip.querySelector('.group')!;
    expect(swatch.className).toContain('flex-1');
    expect(swatch.className).toContain('hover:flex-[1.4]');
    expect(document.querySelector('table')!.className).toContain('w-full');
    expect(document.body.innerHTML).toContain('md:grid-cols-3');
  });

  it('curve charts render always-on hatched constraint regions and external labels', () => {
    renderApp();
    // 6 charts (2 scales × L/C/H) render regions and labels
    expect(document.querySelectorAll('.chart-region-gray').length).toBeGreaterThanOrEqual(6);
    expect(screen.getAllByText('Lightness (L)')).toHaveLength(2);
    expect(screen.getAllByText('Chroma (C)')).toHaveLength(2);
    expect(screen.getAllByText('Hue (H)')).toHaveLength(2);
    // no toggle buttons — overlays are always on
    expect(document.querySelectorAll('svg button')).toHaveLength(0);
  });

  it('contrast matrix renders the 13x13 uicolors-style grid', () => {
    renderApp();
    // axis includes white and black (header + row labels, in both scales' matrices)
    expect(screen.getAllByText('White')).toHaveLength(4);
    expect(screen.getAllByText('Black')).toHaveLength(4);
    // 13 column headers + 13 rows (plus corner header cell) per matrix
    expect(document.querySelectorAll('thead th')).toHaveLength(28);
    expect(document.querySelectorAll('tbody tr')).toHaveLength(26);
    // default APCA filter hides some cells behind muted placeholders
    const stripedPerTable = () =>
      Array.from(document.querySelectorAll('table')).map((t) => t.querySelectorAll('td .bg-muted').length);
    expect(stripedPerTable().every((n) => n > 0)).toBe(true);
  });

  it('contrast matrix threshold pills and metric toggle work', async () => {
    const user = userEvent.setup();
    renderApp();
    const tables = () => Array.from(document.querySelectorAll('table')) as HTMLTableElement[];
    const hidden = () => tables().map((t) => t.querySelectorAll('td .bg-muted').length);
    // click the "All" pill -> nothing is hidden in the first matrix (the second keeps its own filters)
    await user.click(screen.getAllByRole('button', { name: 'All' })[0]!);
    expect(hidden()[0]).toBe(0);
    expect(hidden()[1]).toBeGreaterThan(0);
    // switch to WCAG 2.2 -> helper text describes ratios
    await user.click(screen.getAllByRole('button', { name: 'WCAG 2.2' })[0]!);
    expect(await screen.findByText(/Body text \(minimum\)/)).toBeTruthy();
    expect(hidden()[0]).toBeGreaterThan(0); // default 4.5 threshold hides again
  });

  it('the dark toggle switches the document element class', async () => {
    const user = userEvent.setup();
    renderApp();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Dark' }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(probe().state.dark).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Light' }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('syncs state into the URL for sharing', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Dark' }));
    await waitFor(
      () => {
        expect(window.location.search).toContain('dark=1');
        expect(window.location.search).toContain('pcfg=');
        expect(window.location.search).toContain('ntint=own');
      },
      { timeout: 2000 },
    );
  });

  it('applyConfig restores a config JSON into state; invalid input is rejected', async () => {
    const user = userEvent.setup();
    const json = buildConfigJson({
      preset: { primary: 'red', neutral: 'stone' },
      primary: { anchors: ['#ef4444'], config: { ...defaultConfig(), contrastMode: 'none' } },
      neutral: { anchors: ['#78716c'], config: defaultConfig(), tint: 'primary' },
    });
    render(
      <StudioProvider>
        <App />
        <Probe />
        <ApplyConfigProbe json={json} />
      </StudioProvider>,
    );
    await user.click(screen.getByTestId('apply-config'));
    expect(screen.getByTestId('apply-result').textContent).toBe('ok');
    const p = probe();
    expect(p.state.primaryAnchors).toEqual(['#ef4444']);
    expect(p.state.neutralAnchors).toEqual(['#78716c']);
    expect(p.state.primaryConfig.contrastMode).toBe('none');
    expect(p.state.neutralTint).toBe('primary');
    expect(p.state.primaryPreset).toBe('red');
    expect(p.state.neutralPreset).toBe('stone');

    // invalid text: rejected, state unchanged
    cleanup();
    render(
      <StudioProvider>
        <Probe />
        <ApplyConfigProbe json="not json {" />
      </StudioProvider>,
    );
    await user.click(screen.getByTestId('apply-config'));
    expect(screen.getByTestId('apply-result').textContent).toBe('fail');
  });

  it('copy exports the active tab snippet in its own format', async () => {
    const user = userEvent.setup();
    renderApp();
    // userEvent.setup() resets navigator.clipboard — mock it afterwards
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true });

    // @theme CSS tab (default)
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0]![0]).toContain('--color-primary-500:');

    // JSON tab
    await user.click(screen.getByRole('tab', { name: 'JSON' }));
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    const jsonPayload = JSON.parse(writeText.mock.calls[1]![0] as string);
    expect(jsonPayload.primary.steps['500'].hex).toBeTruthy();

    // Config JSON tab: the payload is a loadable config
    await user.click(screen.getByRole('tab', { name: 'Config JSON' }));
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(3));
    const configPayload = writeText.mock.calls[2]![0] as string;
    expect(configPayload).toContain('"preset"');
    // the copied config round-trips through the loader
    expect(parseConfigJson(configPayload)).not.toBeNull();
  });

  it('the color picker popover opens with area, hue slider and format fields', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getAllByRole('button', { name: 'Open color picker' })[0]!);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeTruthy();
    // the saturation area and the hue slider are ARIA sliders
    expect(screen.getAllByRole('slider').length).toBeGreaterThanOrEqual(2);
    // the fields show the hex format with the format menu (all 5 formats)
    expect(screen.getAllByRole('button', { name: /Color format, HEX/ }).length).toBe(1);
    // eyedropper: not rendered where the EyeDropper API is missing (happy-dom)
    expect(document.querySelector('[data-slot="color-picker-eye-dropper"]')).toBeNull();
    await user.keyboard('{Escape}');
  });

  it('typing a hex into the picker commits the anchor; invalid text is restored', async () => {
    const user = userEvent.setup();
    renderApp();
    const hexInput = screen.getAllByRole('textbox')[0]!;

    // valid hex: committed lowercased, preset cleared
    await user.clear(hexInput);
    await user.keyboard('#FF0000{Enter}');
    expect(probe().state.primaryAnchors).toEqual(['#ff0000']);
    expect(probe().state.primaryPreset).toBeNull();

    // invalid text: dropped, the value is restored (the picker writes hex in capitals), anchor unchanged
    await user.clear(hexInput);
    await user.keyboard('zzz{Enter}');
    expect(probe().state.primaryAnchors).toEqual(['#ff0000']);
    await waitFor(() => expect((hexInput as HTMLInputElement).value).toBe('#FF0000'));
  });
});
