# Stripper — whitelabel monorepo

- `packages/stripper` — the publishable engine, [`@mountfx/stripper`](https://www.npmjs.com/package/@mountfx/stripper)
  on npm: color-scale generation (Tailwind-style scales from a brand color,
  APCA consistent contrast). Its [README](packages/stripper/README.md) is the
  API specification.
- `apps/stripper-studio` — React 19 + Vite + Tailwind v4 + Base UI test app for
  the generator: scale strips, APCA contrast matrix, curve charts, config
  options, export. The L/C/H charts follow the visual language of Stripe's
  accessible color system tool: per-step-colored smooth curves, dynamically
  zoomed domains, and diagonal-hatched unavailable regions (outside sRGB /
  violating the contrast ladder) computed continuously per position. The
  component styling follows Base UI's own component examples.

**Agents:** read [AGENTS.md](AGENTS.md) before making changes — it records the
layering principles, studio contracts, and conventions this repo expects.

## Commands

```sh
pnpm install
pnpm lint          # eslint (correctness rules, no formatting)
pnpm test          # engine + studio tests
pnpm test:coverage # vitest coverage (v8 provider)
pnpm typecheck     # all workspaces
pnpm studio        # palette studio on http://localhost:5173
pnpm build         # production build
```

The studio UI uses a **fixed achromatic color scheme** — it does not react to
the generated scales. The studio manages an arbitrary number of named color
schemes (add, rename, delete, per-scheme random brand color). Each scheme can
display an exact Tailwind v4 preset color (choosable per scheme); switching
any input or option switches that scheme back to a generated scale. State is
URL-synced for sharing, and `/api/colors` serves every scheme.
