import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { ScaleStepNumber } from '@mountfx/stripper';
import App from '../src/App';
import { StudioProvider, useStudio, useFocus } from '../src/context/StudioState';
import { migrateLegacyConfig } from '../src/lib/themeFromParams';
import { buildConfigJson, parseConfigJson } from '../src/lib/configExport';
import { defaultConfig, type Scale } from '@mountfx/stripper';

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
        results: studio.results.map(({ id, result }) => ({ id, scale: summarize(result) })),
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
    dark: boolean;
    schemes: Array<{
      id: string;
      name: string;
      anchors: string[];
      preset: string | null;
      config: { keepAnchorsExact?: boolean; contrastMode: string };
    }>;
  };
  focused: { id: string; step: ScaleStepNumber } | null;
  results: Array<{ id: string; scale: { anchorStep: number; anchors: Array<{ step: number; hex: string }>; hexes: Record<string, string>; kept: Record<string, boolean> } | null }>;
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

  it('renders the two default schemes with 11 swatches each', () => {
    renderApp();
    expect(probe().state.schemes.map((s) => s.name)).toEqual(['primary', 'neutral']);
    // no exact-preset badges on a fresh load
    expect(screen.queryByText('Violet preset (exact)')).toBeNull();
    expect(screen.queryByText('Zinc preset (exact)')).toBeNull();
    expect(probe().state.schemes.every((s) => s.preset === null)).toBe(true);
    // both strips render 11 swatches each; the default brand colors are shown
    expect(swatches()).toHaveLength(22);
    expect(document.body.innerHTML).toContain('#b766dc');
    expect(document.body.innerHTML).toContain('#a49aa8');
  });

  it('renders the export panel with @theme output', () => {
    renderApp();
    const css = screen.getByText(/--color-primary-500: oklch/);
    expect(css.textContent).toContain('@theme {');
  });

  it('adding and deleting schemes works', async () => {
    const user = userEvent.setup();
    renderApp();
    expect(probe().state.schemes).toHaveLength(2);

    // add a third scheme with a fallback name and default anchor
    await user.click(screen.getByRole('button', { name: 'Add scheme' }));
    const p = probe();
    expect(p.state.schemes).toHaveLength(3);
    expect(p.state.schemes[2]!.name).toBe('scheme3');
    expect(p.state.schemes[2]!.anchors).toEqual(['#888888']);
    expect(swatches()).toHaveLength(33);

    // delete the first scheme — the others survive
    await user.click(screen.getByTitle('Delete scheme primary'));
    expect(probe().state.schemes.map((s) => s.name)).toEqual(['neutral', 'scheme3']);
    expect(swatches()).toHaveLength(22);

    // delete down to the last scheme — its delete button disappears
    await user.click(screen.getByTitle('Delete scheme neutral'));
    expect(probe().state.schemes.map((s) => s.name)).toEqual(['scheme3']);
    expect(swatches()).toHaveLength(11);
    expect(screen.queryByTitle(/^Delete scheme /)).toBeNull();
    // but a new scheme can be added again, and then deleted
    await user.click(screen.getByRole('button', { name: 'Add scheme' }));
    expect(probe().state.schemes).toHaveLength(2);
    await user.click(screen.getAllByTitle(/^Delete scheme /)[0]!);
    expect(probe().state.schemes).toHaveLength(1);
  });

  it('renames a scheme and the name flows into the exports', async () => {
    const user = userEvent.setup();
    renderApp();
    const nameInput = screen.getByLabelText('Scheme 1 name');
    await user.clear(nameInput);
    await user.keyboard('accent{Enter}');
    expect(probe().state.schemes[0]!.name).toBe('accent');
    expect(screen.getByText(/--color-accent-500: oklch/)).toBeTruthy();

    // duplicate names get disambiguated
    await user.clear(screen.getByLabelText('Scheme 2 name'));
    await user.keyboard('accent{Enter}');
    expect(probe().state.schemes[1]!.name).toBe('accent-2');

    // clearing a name falls back to the first free schemeN
    await user.clear(screen.getByLabelText('Scheme 2 name'));
    await user.keyboard('{Enter}');
    expect(probe().state.schemes[1]!.name).toBe('scheme1');
  });

  it('the per-scheme random button replaces the brand color and clears the preset', async () => {
    const user = userEvent.setup();
    renderApp('?s1preset=violet&s2=%2371717a');
    expect(probe().state.schemes[0]!.preset).toBe('violet');
    const before = probe().state.schemes[0]!.anchors;
    await user.click(screen.getAllByTitle(/^Random brand color/)[0]!);
    const after = probe().state.schemes[0]!;
    expect(after.preset).toBeNull();
    expect(after.anchors).toHaveLength(1);
    expect(after.anchors).not.toEqual(before);
    expect(after.anchors[0]).toMatch(/^#[0-9a-f]{6}$/);
    // the other scheme is untouched
    expect(probe().state.schemes[1]!.anchors).toEqual(['#71717a']);
  });

  it('the global Random button is gone', () => {
    renderApp();
    expect(screen.queryByRole('button', { name: 'Random' })).toBeNull();
  });

  it('selecting a preset shows the exact Tailwind family scale', async () => {
    const user = userEvent.setup();
    renderApp('?s1preset=blue&s2=%2371717a');
    // blue preset active on load
    expect(probe().state.schemes[0]!.preset).toBe('blue');
    expect(probe().results[0]!.scale!.hexes['500']).toBe('#3b82f6');
    expect(probe().results[0]!.scale!.hexes['950']).toBe('#172554');

    // switch to red via the preset select
    const trigger = screen.getAllByRole('combobox', { name: 'Preset' })[0]!;
    await user.click(trigger);
    await user.click(await screen.findByRole('option', { name: 'Red' }));
    expect(probe().state.schemes[0]!.preset).toBe('red');
    expect(probe().results[0]!.scale!.hexes['500']).toBe('#ef4444');
    // picking a preset also resets the anchors to the family's 500 shade
    expect(probe().state.schemes[0]!.anchors).toEqual(['#ef4444']);
  });

  it('switching back to Custom keeps the anchors and generates from them', async () => {
    const user = userEvent.setup();
    renderApp('?s1preset=blue&s2=%2371717a');
    const trigger = screen.getAllByRole('combobox', { name: 'Preset' })[0]!;
    await user.click(trigger);
    await user.click(await screen.findByRole('option', { name: 'Custom' }));
    expect(probe().state.schemes[0]!.preset).toBeNull();
    expect(probe().state.schemes[0]!.anchors).toEqual(['#3b82f6']);
    // generated scale (ladder-solved lightness) — no longer the exact family table
    const scale = probe().results[0]!.scale!;
    expect(Object.keys(scale.hexes)).toHaveLength(11);
    expect(scale.hexes['500']).not.toBe('#3b82f6');
    expect(scale.hexes['950']).not.toBe('#172554');
  });

  it('any edit to a scheme clears only that scheme’s preset', async () => {
    const user = userEvent.setup();
    renderApp('?s1preset=violet&s2preset=zinc');
    expect(probe().state.schemes[0]!.preset).toBe('violet');
    expect(probe().state.schemes[1]!.preset).toBe('zinc');

    // edit the first scheme's brand color hex (the picker's field reads on Enter)
    const hexInput = screen.getAllByRole('textbox')[1]!; // [0] is the scheme name input
    await user.clear(hexInput);
    await user.keyboard('#ef4444');
    await user.keyboard('{Enter}');
    expect(probe().state.schemes[0]!.anchors).toEqual(['#ef4444']);
    expect(probe().state.schemes[0]!.preset).toBeNull();
    expect(probe().state.schemes[1]!.preset).toBe('zinc');
  });

  it('clicking a swatch copies its hex', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(swatches()[0]!);
    expect(await screen.findByText('copied')).toBeTruthy();
  });

  it('hovering a swatch focuses that step only within its own scheme', async () => {
    const user = userEvent.setup();
    renderApp();
    const primarySwatches = swatches().slice(0, 11);
    const neutralSwatches = swatches().slice(11, 22);
    const id0 = probe().state.schemes[0]!.id;
    const id1 = probe().state.schemes[1]!.id;

    await user.hover(primarySwatches[2]!);
    expect(probe().focused).toEqual({ id: id0, step: 200 });
    // the focused swatch expands
    expect(primarySwatches[2]!.className).toContain('flex-[1.4]');

    // hovering the second scheme's strip takes over its own focus
    await user.hover(neutralSwatches[5]!);
    expect(probe().focused).toEqual({ id: id1, step: 500 });

    // leaving the second scheme clears only that scheme
    await user.unhover(neutralSwatches[5]!);
    expect(probe().focused).toBeNull();
  });

  it('migrates legacy consistentContrast boolean configs to contrastMode', () => {
    expect(migrateLegacyConfig({ consistentContrast: true })).toEqual({ contrastMode: 'apca' });
    expect(migrateLegacyConfig({ consistentContrast: false })).toEqual({ contrastMode: 'none' });
    expect(migrateLegacyConfig({ contrastMode: 'wcag' })).toEqual({ contrastMode: 'wcag' });
    expect(migrateLegacyConfig({ hue: { driftLight: 5, driftDark: 0 } })).toEqual({ hue: { driftLight: 5, driftDark: 0 } });
  });

  it('supports multiple brand colors per scheme (multi-anchor)', async () => {
    const user = userEvent.setup();
    renderApp();
    // add a second brand color to the first scheme
    await user.click(screen.getAllByText('+ Add brand color')[0]!);
    expect(probe().state.schemes[0]!.anchors).toEqual(['#b766dc', '#888888']);
    // preset cleared by the edit
    expect(probe().state.schemes[0]!.preset).toBeNull();
    // both anchor steps get pin markers (first scheme's strip)
    const primaryPins = document.querySelectorAll('.flex.h-24')[0]!.querySelectorAll('span[title="brand color anchored here"]');
    expect(primaryPins.length).toBe(2);
    // removing the second color restores a single-anchor scale
    const removeButtons = screen.getAllByTitle(/^Remove brand color/);
    expect(removeButtons).toHaveLength(2);
    await user.click(removeButtons[1]!);
    expect(probe().state.schemes[0]!.anchors).toEqual(['#b766dc']);
  });

  it('parses multi-anchor and preset URL params', () => {
    renderApp('?s1=%23895af6&s1_2=%2314b8a6&s2=%23798680&s2_2=%23f1f3f3&s2preset=stone');
    const p = probe();
    expect(p.state.schemes[0]!.anchors).toEqual(['#895af6', '#14b8a6']);
    expect(p.state.schemes[1]!.anchors).toEqual(['#798680', '#f1f3f3']);
    expect(p.state.schemes[0]!.preset).toBeNull(); // no s1preset param
    expect(p.state.schemes[1]!.preset).toBe('stone');
  });

  it('ignores unknown preset ids', () => {
    renderApp('?s1preset=not-a-family&s2=%2371717a');
    const p = probe();
    expect(p.state.schemes[0]!.preset).toBeNull();
    expect(p.state.schemes[1]!.preset).toBeNull();
  });

  it('keep brand colors exact: checkbox drives config and anchors stay byte-exact', async () => {
    const user = userEvent.setup();
    renderApp();
    // apca contrast on by default for the first scheme; flag off
    expect(probe().state.schemes[0]!.config.keepAnchorsExact).toBeFalsy();
    // both schemes run the APCA ladder by default -> both panels show the checkbox
    const checkboxes = screen.getAllByRole('checkbox', { name: 'Keep brand colors exact' });
    const checkbox = checkboxes[0]!; // the first scheme's
    expect(checkboxes).toHaveLength(2);
    await user.click(checkbox);
    expect(probe().state.schemes[0]!.config.keepAnchorsExact).toBe(true);
    // anchor steps keep the input hexes exactly
    const scale = probe().results[0]!.scale!;
    for (const anchor of scale.anchors) {
      expect(scale.hexes[String(anchor.step)]).toBe(anchor.hex);
      expect(scale.kept[String(anchor.step)]).toBe(true);
    }
  });

  it('always marks the anchored color in the scale strip', () => {
    renderApp();
    const pins = document.querySelectorAll('span[title="brand color anchored here"]');
    expect(pins.length).toBe(2); // one per scheme
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
    // 6 charts (2 schemes × L/C/H), one merged region path per chart; every
    // scheme's chroma chart always hatches, L/hue hatch where the visible
    // window clips the gamut (the near-gray neutral's L window does not)
    expect(document.querySelectorAll('.chart-region-gray').length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByText('Lightness (L)')).toHaveLength(2);
    expect(screen.getAllByText('Chroma (C)')).toHaveLength(2);
    expect(screen.getAllByText('Hue (H)')).toHaveLength(2);
    // no toggle buttons — overlays are always on
    expect(document.querySelectorAll('svg button')).toHaveLength(0);
  });

  it('contrast matrix renders the 13x13 uicolors-style grid', () => {
    renderApp();
    // axis includes white and black (header + row labels, in both schemes' matrices)
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

  it('cell display never overstates: displayed-N cells stay visible at the N pill', async () => {
    const user = userEvent.setup();
    renderApp();
    const firstTable = () => document.querySelectorAll('table')[0]!;

    // All view: every cell shows its floored magnitude — collect positions per pill
    await user.click(screen.getAllByRole('button', { name: 'All' })[0]!);
    const positionsByPill = new Map<number, Array<[number, number]>>();
    firstTable().querySelectorAll('tbody tr').forEach((tr, r) => {
      tr.querySelectorAll('td').forEach((td, c) => {
        const text = td.querySelector('span')?.textContent ?? '';
        const v = Math.abs(parseInt(text, 10));
        if (!Number.isFinite(v)) return;
        for (const pill of [15, 30, 45, 60]) {
          if (v >= pill) {
            if (!positionsByPill.has(pill)) positionsByPill.set(pill, []);
            positionsByPill.get(pill)!.push([r, c]);
          }
        }
      });
    });
    expect(positionsByPill.get(60)!.length).toBeGreaterThan(0);

    // a cell that displays N must still be visible at the N pill — rounding
    // the display up would make borderline pairs (e.g. Lc 59.6 shown as "60")
    // disappear at their own threshold
    for (const pill of [60, 45, 30, 15]) {
      await user.click(screen.getAllByRole('button', { name: `${pill}+` })[0]!);
      const rows = firstTable().querySelectorAll('tbody tr');
      for (const [r, c] of positionsByPill.get(pill)!) {
        const td = rows[r]!.querySelectorAll('td')[c]!;
        expect(td.querySelector('.bg-muted'), `pill ${pill}, cell ${r},${c}`).toBeNull();
      }
    }
  });

  it('wcag reported-ratio: displayed ≥ N cells stay visible at pill N', async () => {
    const user = userEvent.setup();
    renderApp('?s1=%23895af6&s2=%2371717a'); // known borderline ratio pairs
    const firstTable = () => document.querySelectorAll('table')[0]!;

    await user.click(screen.getAllByRole('button', { name: 'WCAG 2.2' })[0]!);
    await user.click(screen.getAllByRole('button', { name: 'All' })[0]!);
    const positionsByPill = new Map<number, Array<[number, number]>>();
    firstTable().querySelectorAll('tbody tr').forEach((tr, r) => {
      tr.querySelectorAll('td').forEach((td, c) => {
        const v = parseFloat(td.querySelector('span')?.textContent ?? '');
        if (!Number.isFinite(v)) return;
        for (const pill of [4.5, 3]) {
          if (v >= pill) {
            if (!positionsByPill.has(pill)) positionsByPill.set(pill, []);
            positionsByPill.get(pill)!.push([r, c]);
          }
        }
      });
    });
    expect(positionsByPill.get(4.5)!.length).toBeGreaterThan(0);

    for (const pill of [4.5, 3]) {
      await user.click(screen.getAllByRole('button', { name: `${pill}+` })[0]!);
      const rows = firstTable().querySelectorAll('tbody tr');
      for (const [r, c] of positionsByPill.get(pill)!) {
        const td = rows[r]!.querySelectorAll('td')[c]!;
        expect(td.querySelector('.bg-muted'), `pill ${pill}, cell ${r},${c}`).toBeNull();
      }
    }
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
        expect(window.location.search).toContain('s1cfg=');
        expect(window.location.search).toContain('s1name=primary');
        expect(window.location.search).toContain('s2name=neutral');
      },
      { timeout: 2000 },
    );
  });

  it('copy API link copies the endpoint URL for the current state', async () => {
    const user = userEvent.setup();
    renderApp('?s1preset=violet&s2=%2371717a');
    // userEvent.setup() resets navigator.clipboard — mock it afterwards
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true });

    await user.click(screen.getByRole('button', { name: 'Copy API link' }));
    expect(await screen.findByText('Copied!')).toBeTruthy();
    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0]![0] as string;
    // the link targets the colors endpoint with the CURRENT state's params
    expect(copied.startsWith(`${window.location.origin}/api/colors?`)).toBe(true);
    expect(copied).toContain('s1=%238b5cf6'); // violet-500, the preset's anchor
    expect(copied).toContain('s1preset=violet');
    expect(copied).toContain('s2=%2371717a');
    // dark is UI chrome and never part of the endpoint link
    expect(copied).not.toContain('dark=');

    // the link label reverts after the copy flash
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy API link' })).toBeTruthy(), { timeout: 2000 });
  });

  it('applyConfig restores a config JSON into state; invalid input is rejected', async () => {
    const user = userEvent.setup();
    const json = buildConfigJson({
      schemes: [
        { name: 'brand', preset: 'red', anchors: ['#ef4444'], config: { ...defaultConfig(), contrastMode: 'none' } },
        { name: 'neutral', preset: 'stone', anchors: ['#78716c'], config: defaultConfig() },
      ],
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
    expect(p.state.schemes.map((s) => s.name)).toEqual(['brand', 'neutral']);
    expect(p.state.schemes[0]!.anchors).toEqual(['#ef4444']);
    expect(p.state.schemes[1]!.anchors).toEqual(['#78716c']);
    expect(p.state.schemes[0]!.config.contrastMode).toBe('none');
    expect(p.state.schemes[0]!.preset).toBe('red');
    expect(p.state.schemes[1]!.preset).toBe('stone');

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

    // Color JSON tab: minimal shape { primary: [...], neutral: [...] }
    await user.click(screen.getByRole('tab', { name: 'Color JSON' }));
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(3));
    const colorsPayload = JSON.parse(writeText.mock.calls[2]![0] as string);
    expect(colorsPayload.primary).toHaveLength(11);
    expect(colorsPayload.primary[0]).toMatch(/^#[0-9a-f]{6}$/);

    // Config JSON tab: the payload is a loadable config
    await user.click(screen.getByRole('tab', { name: 'Config JSON' }));
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(4));
    const configPayload = writeText.mock.calls[3]![0] as string;
    expect(configPayload).toContain('"schemes"');
    // the copied config round-trips through the loader
    expect(parseConfigJson(configPayload)).not.toBeNull();
  });

  it('exports and API include every scheme, including newly added ones', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Add scheme' }));
    expect(probe().state.schemes).toHaveLength(3);
    expect(screen.getByText(/--color-scheme3-500: oklch/)).toBeTruthy();
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
    const hexInput = screen.getAllByRole('textbox')[1]!; // [0] is the scheme name input

    // valid hex: committed lowercased, preset cleared
    await user.clear(hexInput);
    await user.keyboard('#FF0000{Enter}');
    expect(probe().state.schemes[0]!.anchors).toEqual(['#ff0000']);
    expect(probe().state.schemes[0]!.preset).toBeNull();

    // invalid text: dropped, the value is restored (the picker writes hex in capitals), anchor unchanged
    await user.clear(hexInput);
    await user.keyboard('zzz{Enter}');
    expect(probe().state.schemes[0]!.anchors).toEqual(['#ff0000']);
    await waitFor(() => expect((hexInput as HTMLInputElement).value).toBe('#FF0000'));
  });
});
