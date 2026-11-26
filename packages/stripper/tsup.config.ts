import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  platform: 'neutral',
  // bundle culori: zero runtime dependencies for consumers, and the shipped
  // color math is pinned to the exact culori behavior the tests certify
  noExternal: ['culori'],
});
