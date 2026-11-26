/**
 * APCA-W3 0.0.98G-4g — Accessible Perceptual Contrast Algorithm.
 *
 * Own implementation of the publicly documented base formula
 * (https://github.com/Myndex/SAPC-APCA — APCA-W3-LaTeX.md, 0.0.98G-4g constants).
 *
 * Compliance notes (per the APCA minimum-compliance document):
 * - Current approved constants (0.0.98G-4g).
 * - Correct polarity: dark text on a light background yields POSITIVE Lc,
 *   light text on a dark background yields NEGATIVE Lc (matches apca-w3@0.1.9).
 * - Output clamp: results with |Lc| below ~10 are clamped to 0 (loClip 0.1 pre-scale).
 *
 * The canonical `apca-w3` npm package is licensed under a limited W3/AGPL scheme and
 * is intentionally NOT shipped; it is only used as a dev-time test oracle.
 *
 * Copyright for the algorithm: Andrew Somers / Myndex Research.
 * This file: independent implementation for commercial use.
 */
import { parse, converter } from 'culori';

const toRgb = converter('rgb');

/** The published 0.0.98G-4g constant set (see the module doc for compliance notes). */
export const APCA_098G4G = {
  mainTRC: 2.4,
  sRco: 0.2126729,
  sGco: 0.7151522,
  sBco: 0.072175,
  normBG: 0.56,
  normTXT: 0.57,
  revTXT: 0.62,
  revBG: 0.65,
  blkThrs: 0.022,
  blkClmp: 1.414,
  scaleBoW: 1.14,
  scaleWoB: 1.14,
  loBoWoffset: 0.027,
  loWoBoffset: 0.027,
  deltaYmin: 0.0005,
  loClip: 0.1,
} as const;

/**
 * Screen luminance Y from sRGB channels (0..1 each), per the APCA model.
 */
export function displayY(r: number, g: number, b: number): number {
  const lin = (c: number) => Math.pow(Math.min(Math.max(c, 0), 1), APCA_098G4G.mainTRC);
  return APCA_098G4G.sRco * lin(r) + APCA_098G4G.sGco * lin(g) + APCA_098G4G.sBco * lin(b);
}

/** Y for a CSS color string (any format culori parses). Throws on unparseable input. */
export function displayYof(color: string): number {
  const c = parse(color);
  if (!c) throw new Error(`Unparseable color: ${color}`);
  const rgb = toRgb(c);
  return displayY(rgb.r, rgb.g, rgb.b);
}

/**
 * APCA Lc contrast between text and background Y values.
 * Signature mirrors the canonical implementation: (textY, bgY).
 * Positive = dark text on light bg, negative = light text on dark bg. Range ≈ ±108.
 */
export function apcaLc(txtY: number, bgY: number): number {
  const K = APCA_098G4G;
  if (Number.isNaN(txtY) || Number.isNaN(bgY)) return 0;
  if (txtY < 0 || bgY < 0 || txtY > 1.1 || bgY > 1.1) return 0;

  const soft = (y: number) => (y > K.blkThrs ? y : y + Math.pow(K.blkThrs - y, K.blkClmp));
  const yt = soft(txtY);
  const yb = soft(bgY);

  if (Math.abs(yb - yt) < K.deltaYmin) return 0;

  let output: number;
  if (yb > yt) {
    // dark text on light background -> positive
    const sapc = (Math.pow(yb, K.normBG) - Math.pow(yt, K.normTXT)) * K.scaleBoW;
    output = sapc < K.loClip ? 0 : sapc - K.loBoWoffset;
  } else {
    // light text on dark background -> negative
    const sapc = (Math.pow(yb, K.revBG) - Math.pow(yt, K.revTXT)) * K.scaleWoB;
    output = sapc > -K.loClip ? 0 : sapc + K.loWoBoffset;
  }
  return output * 100;
}

/** Lc for two CSS colors: text color first, background color second. */
export function lc(text: string, background: string): number {
  return apcaLc(displayYof(text), displayYof(background));
}

/** Lc for black text on `background`. */
export function lcBlackOn(background: string): number {
  return lc('#000', background);
}

/** Lc for white text on `background`. */
export function lcWhiteOn(background: string): number {
  return lc('#fff', background);
}
