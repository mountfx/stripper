# Stripper — whitelabel monorepo

- `packages/stripper` — color-scale generation (Tailwind-style scales from a
  brand color, APCA consistent contrast). See its [README](packages/stripper/README.md).
- `apps/stripper-studio` — React 19 + Vite + Tailwind v4 + Base UI test app for
  the generator: scale strips, APCA contrast matrix, curve charts, config
  options, export. The L/C/H charts follow the visual language of Stripe's
  accessible color system tool: per-step-colored smooth curves, dynamically
  zoomed domains, and diagonal-hatched unavailable regions (outside sRGB /
  violating the contrast ladder) computed continuously per position. The
  component styling follows Base UI's own component examples.

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
the generated scales. Each scale can display an exact Tailwind v4 preset color
(choosable per scale); switching any input or option switches that scale back
to generated scales. State is URL-synced for sharing.
