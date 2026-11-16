import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import App from '../src/App.vue';
import { state, applyKonvertoPreset, focused, migrateLegacyConfig } from '../src/composables/useStudioState';
import { lastCopied } from '../src/composables/useClipboard';

describe('studio App', () => {
  it('mounts without runtime errors', () => {
    const wrapper = mount(App, { global: { config: { warnHandler: () => {} } } });
    expect(wrapper.exists()).toBe(true);
    wrapper.unmount();
  });

  it('renders the Konverto preset strips by default and 11 swatches per scale', () => {
    applyKonvertoPreset();
    const wrapper = mount(App);
    const html = wrapper.html();
    expect(html).toContain('primary');
    expect(html).toContain('neutral');
    // preset banner visible
    expect(html).toContain('Konverto preset');
    // both strips render 11 swatches each
    const swatches = wrapper.findAll('.group');
    expect(swatches.length).toBe(22);
    wrapper.unmount();
  });

  it('switches to generated scales when config changes and shows preset banner only in preset mode', async () => {
    applyKonvertoPreset();
    const wrapper = mount(App);
    expect(wrapper.html()).toContain('Konverto preset');
    state.presetMode = false;
    await wrapper.vm.$nextTick();
    expect(wrapper.html()).not.toContain('Konverto preset');
    wrapper.unmount();
  });

  it('renders generated scales with the export panel (@theme output)', () => {
    state.presetMode = false;
    const wrapper = mount(App);
    const html = wrapper.html();
    expect(html).toContain('@theme');
    expect(html).toContain('--color-primary-500');
    wrapper.unmount();
  });

  it('clicking a swatch copies its hex (no selection concept)', async () => {
    state.presetMode = false;
    const wrapper = mount(App);
    const strip = wrapper.findComponent({ name: 'ScaleStrip' });
    await strip.find('.group').trigger('click');
    // clipboard promise resolves the copy after trigger's own nextTick
    await wrapper.vm.$nextTick();
    expect(lastCopied.value).not.toBeNull();
    // the copied value is one of the scale hexes
    expect(state.primaryAnchors[0]).not.toBe('');
    const hexes = strip.props('scale').steps.map((s: { hex: string }) => s.hex);
    expect(hexes).toContain(lastCopied.value);
    wrapper.unmount();
    lastCopied.value = null;
  });

  it('hovering a swatch focuses that step only within its own scale', async () => {
    state.presetMode = false;
    const wrapper = mount(App);
    const primaryStrip = wrapper.findAllComponents({ name: 'ScaleStrip' })[0]!;
    await primaryStrip.findAll('.group')[2]!.trigger('mouseenter');
    await wrapper.vm.$nextTick();
    expect(focused.value).toEqual({ key: 'primary', step: 200 });
    // the focused swatch expands (flex-[1.4]) and reveals its hex
    const focusedSwatch = primaryStrip.findAll('.group').find((sw) => sw.classes().includes('flex-\[1\.4\]') || sw.attributes('style')?.includes('flex-grow: 1.4'));
    expect(focusedSwatch).toBeDefined();

    // hovering the neutral strip takes over its own focus
    const neutralStrip = wrapper.findAllComponents({ name: 'ScaleStrip' })[1]!;
    await neutralStrip.findAll('.group')[5]!.trigger('mouseenter');
    await wrapper.vm.$nextTick();
    expect(focused.value).toEqual({ key: 'neutral', step: 500 });

    // leaving neutral clears only neutral
    await neutralStrip.findAll('.group')[5]!.trigger('mouseleave');
    await wrapper.vm.$nextTick();
    expect(focused.value).toBeNull();
    // regression: chart onDotLeave must scope clearing to its own scale (not clobber the other)
    await primaryStrip.findAll('.group')[0]!.trigger('mouseenter');
    await neutralStrip.findAll('.group')[5]!.trigger('mouseenter');
    await primaryStrip.findAll('.group')[0]!.trigger('mouseleave');
    await wrapper.vm.$nextTick();
    expect(focused.value).toEqual({ key: 'neutral', step: 500 });
    wrapper.unmount();
    focused.value = null;
  });

  it('migrates legacy consistentContrast boolean configs to contrastMode', () => {
    expect(migrateLegacyConfig({ consistentContrast: true })).toEqual({ contrastMode: 'apca' });
    expect(migrateLegacyConfig({ consistentContrast: false })).toEqual({ contrastMode: 'none' });
    expect(migrateLegacyConfig({ contrastMode: 'wcag' })).toEqual({ contrastMode: 'wcag' });
    expect(migrateLegacyConfig({ hue: { driftLight: 5, driftDark: 0 } })).toEqual({ hue: { driftLight: 5, driftDark: 0 } });
  });

  it('supports multiple brand colors per scale (multi-anchor)', async () => {
    state.presetMode = false;
    state.primaryAnchors = ['#895af6', '#14b8a6'];
    const wrapper = mount(App);
    await wrapper.vm.$nextTick();
    const primary = wrapper.findAllComponents({ name: 'ScaleStrip' })[0]!;
    // both anchor steps get pin markers
    const pins = primary.findAll('span[title="brand color anchored here"]');
    expect(pins.length).toBe(2);
    // anchor list editor shows both rows + no add button at... (2 < 4 -> add available)
    const panel = wrapper.findAllComponents({ name: 'ConfigPanel' })[0]!;
    expect(panel.props('anchors')).toEqual(['#895af6', '#14b8a6']);
    // removing the second color restores a single-anchor scale
    const removeButtons = panel.findAll('button').filter((b) => b.attributes('title')?.startsWith('Remove brand color'));
    expect(removeButtons.length).toBe(2);
    await removeButtons[1]!.trigger('click');
    expect(state.primaryAnchors).toEqual(['#895af6']);
    wrapper.unmount();
    state.primaryAnchors = ['#a286fd'];
  });

  it('parses multi-anchor URL params (p2..p4 / n2..n4)', async () => {
    window.history.replaceState(null, '', '?p=%23895af6&p2=%2314b8a6&n=%23798680&n2=%23f1f3f3');
    vi.resetModules();
    const mod = await import('../src/composables/useStudioState');
    expect(mod.state.primaryAnchors).toEqual(['#895af6', '#14b8a6']);
    expect(mod.state.neutralAnchors).toEqual(['#798680', '#f1f3f3']);
    window.history.replaceState(null, '', '/');
    vi.resetModules();
  });

  it('keep brand colors exact: checkbox drives config and anchors stay byte-exact', async () => {
    state.presetMode = false;
    state.primaryAnchors = ['#895af6', '#14b8a6'];
    state.primaryConfig = { ...state.primaryConfig, contrastMode: 'apca' };
    try {
    const wrapper = mount(App);
    const panel = wrapper.findAllComponents({ name: 'ConfigPanel' })[0]!;
    // flag off by default
    expect(state.primaryConfig.keepAnchorsExact).toBeFalsy();
    // toggle the checkbox
    const checkbox = panel.find('#keep-primary');
    await checkbox.trigger('click'); // shadcn Checkbox renders a reka-ui button
    await wrapper.vm.$nextTick();
    expect(state.primaryConfig.keepAnchorsExact).toBe(true);
    // anchor steps keep the input hexes exactly
    const scale = wrapper.findAllComponents({ name: 'ScaleStrip' })[0]!.props('scale');
    for (const anchor of scale.anchors) {
      const step = scale.steps.find((s: { number: number }) => s.number === anchor.step);
      expect(step.hex).toBe(anchor.hex);
      expect(step.kept).toBe(true);
    }
    // switching contrast mode to none hides the checkbox (no-op there)
    state.primaryConfig = { ...state.primaryConfig, contrastMode: 'none' };
    await wrapper.vm.$nextTick();
    expect(panel.find('#keep-primary').exists()).toBe(false);
    wrapper.unmount();
  } finally {
    state.primaryAnchors = ['#a286fd'];
    state.primaryConfig = { ...state.primaryConfig, keepAnchorsExact: undefined };
  }
  });

  it('always marks the anchored color in the scale strip', async () => {
    state.presetMode = false; // generated single-anchor scale
    const wrapper = mount(App);
    await wrapper.vm.$nextTick();
    const strip = wrapper.findComponent({ name: 'ScaleStrip' });
    const scale = strip.props('scale');
    expect(scale.anchors).toHaveLength(1);
    const pins = strip.findAll('span[title="brand color anchored here"]');
    expect(pins.length).toBe(1);
    wrapper.unmount();
  });

  it('scale strip is horizontal above the full-width matrix', () => {
    state.presetMode = false;
    const wrapper = mount(App);
    const strip = wrapper.findComponent({ name: 'ScaleStrip' });
    expect(strip.props('vertical')).toBeUndefined();
    expect(strip.classes()).toContain('h-24'); // horizontal row
    const swatch = strip.find('.group');
    expect(swatch.classes()).toContain('flex-1'); // swatches share the full width
    expect(swatch.classes()).toContain('hover:flex-[1.4]');
    const matrix = wrapper.findComponent({ name: 'ContrastMatrix' });
    expect(matrix.find('table').classes()).toContain('w-full'); // matrix fills the whole width
    // charts sit side by side in the 3-column grid
    expect(wrapper.html()).toContain('md:grid-cols-3');
    wrapper.unmount();
  });

  it('curve charts render always-on hatched constraint regions per metric', async () => {
    state.presetMode = false;
    state.primaryConfig = { ...state.primaryConfig, contrastMode: 'apca' };
    const wrapper = mount(App);
    const charts = wrapper.findAllComponents({ name: 'CurveChart' });
    const lChart = charts.find((c) => c.props('metric') === 'l')!;
    const cChart = charts.find((c) => c.props('metric') === 'c')!;
    const hChart = charts.find((c) => c.props('metric') === 'h')!;
    // L chart: gray gamut hatching under APCA (the amber hatch was replaced by warnings + matrix)
    expect(lChart.find('.chart-region-gray').exists()).toBe(true);
    expect(lChart.find('.chart-region-amber').exists()).toBe(false);
    // no Constraints toggle — overlays are always on
    expect(lChart.find('button').exists()).toBe(false);
    // none mode: gray gamut hatching only — no contract regions
    state.primaryConfig = { ...state.primaryConfig, contrastMode: 'none' };
    await wrapper.vm.$nextTick();
    expect(lChart.find('.chart-region-gray').exists()).toBe(true);
    expect(lChart.find('.chart-ladder-line').exists()).toBe(false);
    state.primaryConfig = { ...state.primaryConfig, contrastMode: 'apca' };
    await wrapper.vm.$nextTick();
    // C chart: gray hatching above the displayable chroma ceiling
    expect(cChart.find('.chart-region-gray').exists()).toBe(true);
    // H chart: gray hatching only — hue has no ladder contract
    expect(hChart.find('.chart-region-gray').exists()).toBe(true);
    expect(hChart.find('.chart-region-amber').exists()).toBe(false);
    // single tooltip implementation: no dark SVG fallback tooltip
    expect(lChart.findAll('rect.fill-zinc-900\\/90').length).toBe(0);
    wrapper.unmount();
    state.primaryConfig = { ...state.primaryConfig, contrastMode: 'apca' };
  });

  it('contrast matrix renders the 13x13 uicolors-style grid', () => {
    state.presetMode = false;
    const wrapper = mount(App);
    const matrix = wrapper.findComponent({ name: 'ContrastMatrix' });
    const html = matrix.html();
    // axis includes white and black
    expect(html).toContain('White');
    expect(html).toContain('Black');
    // 13 column headers + 13 rows (plus corner header cell)
    expect(matrix.findAll('thead th').length).toBe(14);
    expect(matrix.findAll('tbody tr').length).toBe(13);
    // default APCA filter hides some cells behind striped placeholders
    expect(matrix.findAll('.bg-striped').length).toBeGreaterThan(0);
    wrapper.unmount();
  });

  it('contrast matrix threshold pills and metric toggle work', async () => {
    state.presetMode = false;
    const wrapper = mount(App);
    const matrix = wrapper.findComponent({ name: 'ContrastMatrix' });
    // click the "All" pill -> nothing is striped
    const allPill = matrix.findAll('button').find((b) => b.text() === 'All')!;
    await allPill.trigger('click');
    await wrapper.vm.$nextTick();
    expect(matrix.findAll('.bg-striped').length).toBe(0);
    // switch to WCAG 2.2 -> helper text describes ratios
    const wcagToggle = matrix.findAll('button').find((b) => b.text() === 'WCAG 2.2')!;
    await wcagToggle.trigger('click');
    await wrapper.vm.$nextTick();
    expect(matrix.html()).toContain('Body text (minimum)');
    expect(matrix.findAll('.bg-striped').length).toBeGreaterThan(0); // default 4.5 threshold hides again
    wrapper.unmount();
  });


  it('injects the generated scales as semantic theme vars (specificity-raised)', async () => {
    state.presetMode = false;
    const wrapper = mount(App);
    await new Promise((r) => setTimeout(r, 10));
    const style = document.getElementById('studio-theme');
    expect(style).not.toBeNull();
    expect(style!.textContent).toContain('html:root');
    expect(style!.textContent).toContain('html.dark');
    expect(style!.textContent).toContain('--background');
    // changing the brand color updates the injected theme
    const before = style!.textContent;
    state.primaryAnchors = ['#ff0000'];
    await wrapper.vm.$nextTick();
    await new Promise((r) => setTimeout(r, 10));
    expect(style!.textContent).not.toBe(before);
    wrapper.unmount();
    state.primaryAnchors = ['#a286fd'];
  });

  it('curve charts render titles outside the chart with hover tooltip nodes', () => {
    state.presetMode = false;
    const wrapper = mount(App);
    const charts = wrapper.findAllComponents({ name: 'CurveChart' });
    expect(charts.length).toBe(6);
    for (const chart of charts) {
      const html = chart.html();
      // label rendered as plain text above the svg, no svg <text> title inside
      expect(['Lightness (L)', 'Chroma (C)', 'Hue (H)'].some((l) => html.includes(l))).toBe(true);
    }
    wrapper.unmount();
  });
});
