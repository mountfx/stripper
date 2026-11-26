# stripper

Framework-agnostic TypeScript engine that generates Tailwind-style 11-step color
scales (50–950) from brand colors, with fixed "consistent contrast" ladders
(APCA Lc and WCAG 2.2 ratio) baked into the generation pipeline.

Built for whitelabel theming: a client provides brand colors, the engine derives
the full scales. The engine is **role-agnostic** — which scale is "primary" or
"neutral", and any per-role defaults, are application-layer decisions.

Everything is exported flat from the package root.

## Install

```sh
npm install @mountfx/stripper
```

ESM-only, ships as a typed, self-contained `dist/` bundle (no runtime
dependencies — the color math is bundled and pinned). Runs on Node ≥ 20 and in
every modern bundler.

---

## Quick start

```ts
import { generateScale, toThemeCss } from '@mountfx/stripper';

const scale = generateScale('#895af6'); // balanced curve + consistent APCA contrast
const neutral = generateScale('#798680', { ...defaultConfig(), contrastMode: 'none' });

const css = toThemeCss([
  { name: 'primary', scale },
  { name: 'neutral', scale: neutral },
]);
// -> @theme { --color-primary-500: oklch(60.1% 0.238 293.6); ... }
```

---

## `generateScale(input, config?)`

```ts
function generateScale(
  input: string | Array<string | ScaleAnchor>,
  config?: ScaleConfig,
): Scale
```

Generates an 11-step scale (steps `50, 100, 200, 300, 400, 500, 600, 700, 800,
900, 950`). Throws on unparseable color inputs.

### Input forms

| Form | Behavior |
|------|----------|
| `'#895af6'` | Single brand color, anchored at the step its lightness naturally belongs to. |
| `['#895af6', '#14b8a6']` | **Multi-anchor scale** (2–4 colors): the scale transitions between them. |
| `[{ hex, anchor? }]` | Anchors with explicit steps. `anchor: ScaleStepNumber \| 'auto'`; explicit steps are honored when free. |

### `ScaleConfig`

```ts
interface ScaleConfig {
  baseMode: 'tailwindTransfer' | 'balancedCurve';   // default: 'balancedCurve'
  contrastMode: 'none' | 'apca' | 'wcag';           // default: 'apca'
  keepAnchorsExact?: boolean;                       // default: false
  hue: {
    tint?: number;        // fixed hue override for every step (single-anchor only)
    driftLight: number;   // hue drift at step 50, degrees (0 at the anchor)
    driftDark: number;    // hue drift at step 950, degrees (0 at the anchor)
  };
  chroma: {
    taperLight: number;   // chroma factor at step 50 (1 = untapered, 0 = gray)
    taperDark: number;    // chroma factor at step 950
  };
}
```

| Option | Notes |
|--------|-------|
| `baseMode: 'tailwindTransfer'` | Picks the closest Tailwind v4 family (CIE Lab ΔE) and transfers its lightness/saturation curves to the input hue — uicolors' approach. Gray-ish inputs (HSL sat ≤ 0.15) compare against gray families only; their subtle tint is preserved via the gray chroma curve. |
| `baseMode: 'balancedCurve'` | Averaged OKLCH lightness/chroma profile of all chromatic families with the input hue. The default; also the right choice for hues with no close Tailwind family. |
| `contrastMode: 'apca'` | Each step's lightness is re-solved (hue/chroma kept) so \|Lc\| against black (steps < 500) or white (steps ≥ 500) matches `APCA_CONTRAST_TARGETS`. |
| `contrastMode: 'wcag'` | Same, using WCAG 2.2 contrast ratios against `WCAG_CONTRAST_TARGETS`. |
| `contrastMode: 'none'` | Aesthetic only — lightness comes from the base curve; the input color is pinned exactly at its anchor step. |
| `hue.tint` | Fixed hue for every step, before drift. The mechanism for brand-harmonized neutrals (e.g. borrow the primary's hue). Especially relevant for pure/near-gray inputs whose own OKLCH hue is numerically meaningless. |
| `keepAnchorsExact` | With a ladder active (`apca`/`wcag`): anchor steps keep the input colors **byte-exact** (step flagged `kept: true`) while every other step stays ladder-solved. Anchor steps may then deviate from their ladder target — surfaced via a warning (e.g. "Step 500: brand color kept exact (Lc 43 vs ladder target 55)"). No-op in `none` mode (anchors are already exact). The sanctioned exception to brand-color coherence: explicit opt-in for brand-guideline-driven cases (cf. uicolors' `lockInputColor`). |
| `hue.drift*` | Linear hue rotation from the anchor (zero drift at the anchor) toward each extreme. |
| `chroma.taper*` | Fades chroma toward the extremes (1 at the anchor, `taper` at the scale end). The sRGB gamut clamp is the only chroma ceiling. |

`defaultConfig(): ScaleConfig` — balanced curve, APCA ladder on, no tint, no shaping.

### Return: `Scale`

```ts
interface Scale {
  input: string;                 // first anchor, normalized to #rrggbb
  anchorStep: ScaleStepNumber;   // first anchor's resolved step
  anchors: Array<{ step: ScaleStepNumber; hex: string }>;  // resolved anchors (always present; single-anchor scales have exactly one)
  steps: Array<{
    number: 50 | 100 | ... | 950;
    hex: string;                 // #rrggbb, always inside sRGB
    oklch: { l: number; c: number; h: number };
    hsl: { h: number; s: number; l: number };
    approximated?: boolean;      // ladder target not exactly reachable (closest used)
  }>;
  closestFamily?: string;        // Tailwind family name (tailwindTransfer mode)
  warnings: string[];            // conflicts, unreachable targets, carve-out notices
}
```

### Multi-anchor scales (2–4 brand colors in one scale)

```ts
const duotone = generateScale(['#895af6', '#14b8a6']);       // violet -> teal
const placed  = generateScale([
  { hex: '#f5f7ff', anchor: 100 },
  { hex: '#895af6', anchor: 600 },
]);
```

Rules:

- Anchors resolve to steps by lightness; the ramp requires the colors' lightness
  order to match their step order. Conflicts (e.g. two mid-tone colors) are
  **auto-placed on the nearest free step with warnings**, never rejected.
- Between adjacent anchors, hue interpolates **shortest-arc** and chroma follows
  a per-anchor scaling factor over the balanced profile — each anchor color is
  reproduced **exactly** at its step (with a contrast ladder active, lightness is
  contract-owned as usual).
- Carve-outs for multi-anchor scales: the balanced skeleton is always used —
  `tailwindTransfer`, hue `drift` and hue `tint` do not apply (a warning
  is emitted when they are configured). Chroma taper applies only outside the
  outermost anchors.
- Caveat: distant hues can produce desaturated mid steps ("mud"); OKLCH
  interpolation minimizes it, and a future `chromaBoost` option could compensate.
- More than `MAX_ANCHORS` (4) anchors are truncated with a warning.

### Intentional omissions

The anchor step is always detected from the input's lightness (or given
explicitly per anchor); there is no hue offset, chroma multiplier, or chroma cap —
any of those would detach the brand color from the scale it generates. The
contrast ladders are likewise not configurable: they are the system's contrast
contract. If contrast variants are ever needed, implement them as named modes
(e.g. `contrastProfile: 'default' | 'strict'`), not as editable tables.

---

## Contrast functions

### APCA — W3 0.0.98G-4g (`apca.ts`)

Own implementation of the published formula, verified against the canonical
`apca-w3` package in tests (dev-only oracle; not shipped due to its W3-limited
license). Polarity: **dark text on light bg → positive Lc**, light text on dark
bg → negative. Range ≈ ±108.

```ts
lc(text: string, background: string): number
apcaLc(txtY: number, bgY: number): number   // the primitive on Y values
lcBlackOn(background: string): number
lcWhiteOn(background: string): number
apcaLevel(lc: number): 90 | 75 | 60 | 45 | 30 | 15 | null   // APCA Readability Criterion levels
APCA_LEVELS                                 // the level table: { min, label }
displayY(r, g, b): number            // APCA screen luminance
displayYof(color: string): number
APCA_098G4G                          // the constant set
```

### WCAG 2.2 (`wcag.ts`)

Same formula since WCAG 2.0 (piecewise sRGB linearization — a different transfer
curve than APCA's pure 2.4-power Y). Symmetric ratios, 1–21, no sign.

```ts
wcagRatio(text: string, background: string): number
ratioOnBlack(background: string): number
ratioOnWhite(background: string): number
wcagLevel(ratio: number): 7 | 4.5 | 3 | null   // AAA / AA / large-text + non-text
WCAG_LEVELS                                    // the level table: { min, label }
wcagLuminance(r, g, b): number
wcagLuminanceOf(color: string): number
```

**Level functions are strict raw minimums** (`apcaLevel(59.999)` is 45, not 60):
levels are judged on the actual contrast value, with no rounding. Reporting
conventions (e.g. showing Lc as a rounded integer) are application-layer
decisions.

### Inspection

```ts
criticalPairWarnings(scale: Scale): string[]
// warnings for UI-critical pairings: white text on 600 (< 60 Lc), white on
// 500 (< 45), black text on 100 (< 60)

lc(text, background) / wcagRatio(text, background)   // any pair, see above
```

---

## Contrast ladders (engine-owned constants)

```ts
APCA_CONTRAST_TARGETS: Record<ScaleStepNumber, { lc: number; bg: 'black' | 'white' }>
// steps < 500 measured vs black: 50 −103 · 100 −97 · 200 −88 · 300 −75 · 400 −60
// steps ≥ 500 measured vs white: 500 +55 · 600 +67 · 700 +78 · 800 +86 · 900 +92 · 950 +101

WCAG_CONTRAST_TARGETS: Record<ScaleStepNumber, { ratio: number; bg: 'black' | 'white' }>
// steps < 500 vs black: 19 · 15.5 · 12 · 9 · 6.5 :1
// steps ≥ 500 vs white: 4.5 · 6.5 · 9 · 12 · 15.5 · 19 :1  (500 = AA body for white text)

targetFor(step): ApcaTarget
wcagTargetFor(step): WcagTarget

// gamut diagnostics
maxSrgbChroma(l, h): number
// largest chroma at lightness l / hue h that stays inside sRGB

displayableLightnessRange(c, h): { lo, hi } | null
// the lightness interval for which oklch(l, c, h) exists in sRGB (null when none does)

inSrgb(color: ColorInput): boolean
// whether a color renders inside sRGB; ColorInput = CSS color string or a
// color-space object like { mode: 'oklch', l, c, h }

gamutClamp(ok: Oklch): Oklch          // reduce chroma (never L/H) until in sRGB
stepToHex(ok: Oklch): string          // hex of an Oklch color (clamped)
oklchOfHex(hex): Oklch, hslOfHex(hex) // color-space views of a hex string
clampHue(h): number                   // normalize to 0..360
lerp(a, b, t), lerpHue(a, b, t)       // linear + shortest-arc hue interpolation

ladderBoundaryL(h, c, step, contrastMode, toleranceOverride?): { l: number; reachable: boolean }
// the lightness at which the active ladder is met for a color of the given
// hue/chroma — the boundary of the "contract channel". Strict: the boundary
// must exist at the given chroma (no clamping), so impossible targets are
// flagged `reachable: false`. `none` mode has no contract.
// toleranceOverride (default: the mode's tolerance, ±2 Lc / ±0.1 ratio)
// relaxes or zeroes the boundary edge (0 = exact target).

CONTRAST_MODES                          // per-mode tolerance map (±2 Lc / ±0.1 ratio)
ContrastModeDef                         // the record type behind CONTRAST_MODES
solveLightnessFor(...), withinTolerance(...), resolveLadderAnchorStep(...)
// lower-level ladder / anchor-placement internals, exported for advanced use
```

These ladders are the system's contrast contract and are intentionally **not
configurable**: every generated scale satisfies the same relationships
regardless of brand hue, which is what makes whitelabel themes mutually
consistent. Unreachable targets (extreme hues/chromas) fall back to the closest
achievable lightness, flagged via `step.approximated` and a warning.

---

## Export helpers

```ts
toThemeCss(scales: Array<{ name: string; scale: Scale }>): string
// @theme { --color-primary-500: oklch(60.1% 0.238 293.6); ... }  (Tailwind v4)

toJson(scales): string        // JSON tokens incl. hex/oklch/hsl per step
toColorsJson(scales): string  // minimal JSON: { "<name>": ["#..", ...] } per scale (hex, step order)
oklchString(step): string     // "oklch(60.1% 0.238 293.6)"

toSwiftUi(scales): string     // SwiftUI: extension Color { static let primary500 = Color(red: 0.6353, green: 0.5255, blue: 0.9922)  // #a286fd }
toKotlin(scales): string      // Jetpack Compose: val PRIMARY_500 = Color(0xFFA286FD)
```

Scale names are sanitized into valid identifiers per language (`my-brand` →
`myBrand` in Swift, `MY_BRAND` in Kotlin); the original name is kept in the
section comments. The config JSON (the applied `ScaleConfig` per scheme) is an
application-layer export — the engine intentionally does not retain configs on
`Scale` (see Design principles: role-agnostic engine).

## Presets & data

```ts
TAILWIND_FAMILIES          // 22 Tailwind v4 families, hex per step
scaleFromFamily(family)    // exact Scale from a family (anchored at 500)
familyById(id)             // 'blue' -> Blue family
CHROMATIC_PROFILE / GRAY_PROFILE   // averaged OKLCH L/C curves per step (FamilyProfile)
GRAY_FAMILY_NAMES          // Slate/Gray/Zinc/Neutral/Stone
SCALE_STEPS                // [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
MAX_ANCHORS                // 4 — the multi-anchor cap enforced by generateScale

// utilities
pickClosestFamily(hex): { family, anchorStep }
toHex(color): string          // normalize any parseable CSS color to #rrggbb
stepIndex(step): number
```

---

## How it works (pipeline)

1. **Anchor** — resolved from the input's lightness (nearest family shade for
   `tailwindTransfer`, nearest profile lightness for `balancedCurve`), or given
   explicitly per anchor. Under a contrast ladder (`apca`/`wcag`) the anchor is
   instead placed where the ladder demands the **least lightness distortion**
   from the input color — each step's target is solved for the input's
   hue/chroma and the closest match wins, so kept anchors (`keepAnchorsExact`)
   land in-contract and unreachable targets steer placement to feasible
   neighbors. Every shaping option derives from the anchor: the brand color
   stays the coherent origin of the scale.
2. **Base curve** per step (see `baseMode` above).
3. **Hue shaping** — fixed `tint` (single-anchor only) + linear drift toward the
   extremes (zero at the anchor).
4. **Chroma tapering** — toward the extremes; multi-anchor scales taper only
   outside their outermost anchors.
5. **Gamut clamp** — chroma is reduced (never L or H) until every step is inside
   sRGB.
6. **Consistent contrast** — per-step lightness re-solve against the fixed ladder
   (per `contrastMode`), with closest-achievable fallback + `approximated` flag.
7. **Anchor pin** — the input color is reproduced exactly at its anchor step
   (hue/chroma under a ladder; full color in `none` mode).

## Design principles

- **Brand color coherence** — no knob may detach the brand color from the scale
  it generates (that is why there is no hue offset, chroma multiplier, or cap).
  The single sanctioned exception is `keepAnchorsExact`: an explicit opt-in that
  keeps brand colors byte-exact at their anchor steps under a ladder, with the
  resulting deviation surfaced as a warning and a lightness-monotonicity check
  guarding against inverted ramps.
- **Contract ownership** — the contrast ladders belong to the design system, not
  to theme authors; accessibility guarantees cannot be weakened per theme.
- **Layering** — the engine is role-agnostic and has no UI concepts; "primary"/
  "neutral" semantics, per-role defaults, and tint policies live in the
  application layer.
- **APCA licensing** — the APCA implementation follows the published 0.0.98G-4g
  formula with compliant polarity, constants, and clamping; the canonical
  `apca-w3` package is used only as a dev-time test oracle.

## Tests

`pnpm test` — golden-value parity of the APCA implementation against the
canonical `apca-w3` oracle, APCA ladder adherence (±2 Lc), WCAG ladder adherence
(±0.1 ratio), multi-anchor pin/transition/conflict behavior, gamut safety, and
export snapshots.
