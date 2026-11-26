/**
 * `@mountfx/stripper` — color-scale generation engine.
 *
 * Generates Tailwind-style 11-step scales (50–950) from one or more brand
 * colors, with fixed consistent-contrast ladders (APCA Lc, WCAG 2.2) baked
 * into the generation pipeline. The engine is role-agnostic — "primary" and
 * "neutral" semantics, defaults, and tint policies live in the application
 * layer. Everything is exported flat from the package root; the README is
 * the API specification.
 *
 * @example
 * ```ts
 * import { generateScale, toThemeCss } from "@mountfx/stripper";
 *
 * const scale = generateScale("#895af6"); // balanced curve + consistent APCA contrast
 * const css = toThemeCss([{ name: "primary", scale }]);
 * // -> @theme { --color-primary-500: oklch(60.1% 0.238 293.6); ... }
 * ```
 *
 * @module
 */
export * from './types';
export * from './apca';
export * from './wcag';
export * from './families';
export * from './targets';
export * from './locate';
export * from './generate';
export { maxSrgbChroma, gamutClamp, stepToHex, oklchOfHex, hslOfHex, displayableLightnessRange, clampHue, lerp, lerpHue, inSrgb } from './gamut';
export { ladderBoundaryL, solveLightnessFor, withinTolerance, CONTRAST_MODES } from './ladder';
export { resolveLadderAnchorStep } from './anchor-resolution';
export { MAX_ANCHORS } from './multi-anchor';
export type { LadderBoundary, ContrastModeDef } from './ladder';
export * from './contrast';
export * from './export';
