# Konverto Lab — whitelabel monorepo

- `packages/stripper` — color-scale generation (Tailwind-style scales from a
  brand color, APCA consistent contrast). See its [README](packages/stripper/README.md).
- `apps/stripper-studio` — Vue 3 + Vite + Tailwind v4 test app for the generator:
  scale strips, APCA contrast matrix, curve charts, config options, export.
  The L/C/H charts follow the visual language of Stripe's accessible color
  system tool: per-step-colored smooth curves, dynamically zoomed domains, and
  diagonal-hatched unavailable regions (outside sRGB / violating the contrast
  ladder) computed continuously per position.

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

The studio defaults to the exact Konverto Lab preset (holly / electric-violet);
switching any input or option switches to generated scales. State is URL-synced
for sharing.
