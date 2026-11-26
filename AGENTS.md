# AGENTS.md

Guidance for AI agents (and humans) working in this repository. Read this before
making changes; it condenses the design decisions that the code and docs assume.

## Repository layout

- `packages/stripper` — the publishable engine (`@mountfx/stripper` on npm).
  Pure color math: generates Tailwind-style 11-step scales (50–950) from brand
  colors with fixed consistent-contrast ladders (APCA Lc, WCAG 2.2). **Its
  README is the API specification** — keep it in sync with every export change.
- `apps/stripper-studio` — the React 19 + Vite + Tailwind v4 + Base UI test
  application for the engine. Consumes the engine as TS source (the package's
  dev `exports` point at `src/index.ts`; the published artifact is the bundled
  `dist/` via tsup + `publishConfig`).

## Layering principle (do not violate)

The engine is **role-agnostic**: it has no UI concepts and no notion of
"primary", "neutral", or any scheme role. Scheme naming, defaults, tint
policies, and reporting conventions live in the application layer (studio).
The engine's config JSON is an application-layer export; the engine never
retains configs on `Scale`.

Design principles of record (brand-color coherence, contract ownership, layering,
APCA licensing): `packages/stripper/README.md` → "Design principles".

## Engine facts

- `generateScale(input, config?)` is the single entry point; everything else is
  inspection/export/data. Throws on unparseable color inputs.
- The contrast ladders (`APCA_CONTRAST_TARGETS`, `WCAG_CONTRAST_TARGETS`) are
  the system's contract and are intentionally **not configurable**; generation
  tolerance is ±2 Lc / ±0.1 ratio, with closest-achievable fallback flagged via
  `step.approximated`.
- `apcaLevel` / `wcagLevel` are **strict raw minimums** — they never round.
  `criticalPairWarnings` likewise compares raw values.
- Every exported symbol is public API (published to npm): document it in the
  engine README or un-export it. There is no "internal but exported" tier.

## Studio architecture

- **State model** (`src/context/StudioState.tsx`): `{ dark, schemes:
  ColorScheme[] }`. A scheme is `{ id, name, anchors, config, preset }`. Any
  number of schemes; the last remaining scheme cannot be deleted. Scheme ids
  are internal (React keys / focus scope); names drive token names in exports.
- **URL format** (`src/lib/themeFromParams.ts`, shared with the API):
  - `s1=<hex>`, `s1_2..s1_4` extra anchors, `s1cfg` (base64 `ScaleConfig`),
    `s1preset` (Tailwind family id), `s1name` — one indexed group per scheme.
  - `dark=1` is UI chrome; the `/api/colors` endpoint ignores it.
  - **No legacy params** — old `p`/`n`/`pcfg`/`ntint` links fall back to
    defaults (there is a test pinning that).
- **API** (`api/colors.ts` + `src/lib/colorsEndpoint.ts`): `GET /api/colors`
  serves every scheme as `{ "<name>": [hex…] }`; 400 if any scheme fails to
  generate. Same derivation as the studio UI (`themeFromParams`).
- **Config JSON** (`src/lib/configExport.ts`): `{ schemes: [{ name, preset,
  anchors, config }] }` — round-trips through "Load config". Legacy
  `consistentContrast` booleans are still migrated (deliberate).
- **Reported-value convention** (`src/components/ContrastMatrix.tsx`): the
  contrast matrix reports Lc as a rounded integer (`reportedLc`) and WCAG
  ratios at one decimal (`reportedRatio`); pill visibility, displayed value,
  and tooltip level text all judge the **reported** value, so a cell that
  reads "60" never toggles at the 60+ pill. Coherent with the engine's ±2 Lc
  generation tolerance. The engine stays strict — do not "fix" the engine to
  round.
- **Constraint-region rendering** (`src/components/CurveChart.tsx` +
  `src/lib/chartMath.ts`): all three charts (L/C/H) hatch the **literal
  out-of-gamut set** as smooth closed contours — a 96×64 displayability grid,
  marching squares with subpixel predicate bisection (`traceIsoContours`),
  Chaikin smoothing, one `evenodd` path per chart. Islands and holes are
  intended (Stripe-style; no keep-clear channel — the curve draws on top of
  the hatch). Regions merge through columns where nothing is displayable
  (gamut-tip overshoot); that is data, not a bug.
- **UI achromatic scheme**: the studio's own colors are fixed and do not react
  to the generated scales.

## Conventions

- Tests are the spec for behavior changes; keep the engine's golden-value
  parity (apca-w3 dev oracle), ladder adherence (±2 Lc), and the studio's
  invariant tests green.
- Verify with `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` (CI runs
  exactly these; see `.github/workflows/ci.yml`).
- No legacy support for superseded URL/config formats beyond the deliberate
  `consistentContrast` migration; remove dead code rather than documenting it.
