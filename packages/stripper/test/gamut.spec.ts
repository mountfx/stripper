import { describe, it, expect } from 'vitest';
import { displayableHueRange, displayableLightnessRange } from '../src/gamut';

describe('displayableLightnessRange', () => {
  it('spans the full 0..1 axis for achromatic colors', () => {
    expect(displayableLightnessRange(0, 0)).toEqual({ lo: 0, hi: 1 });
    expect(displayableLightnessRange(0, 180)).toEqual({ lo: 0, hi: 1 });
  });

  it('narrows the interval as chroma grows and returns null beyond the gamut', () => {
    // at chroma 0.05 the extreme lightness ends stop being displayable
    const tinted = displayableLightnessRange(0.05, 180);
    expect(tinted!.lo).toBeGreaterThan(0);
    expect(tinted!.hi).toBeLessThan(1);
    expect(tinted!.lo).toBeLessThan(tinted!.hi);
    // at a chroma nothing can display (near the sRGB corner), no lightness works
    const extreme = displayableLightnessRange(0.5, 0.4);
    expect(extreme).toBeNull();
  });
});

describe('displayableHueRange', () => {
  // hue window of the #ff40ff/#1a0a53 multi-anchor H chart (unwrapped domain)
  const DMIN = 257;
  const DMAX = 353;

  it('finds narrow displayable arcs that a grid scan misses', () => {
    // step 400 of the #ff40ff/#1a0a53 scale (#ff7efd) is a real sRGB color whose
    // displayable hue arc is ~1.45deg wide — invisible to the old 3deg grid scan,
    // which produced false full-height hatch columns between steps 300 and 500
    const arc = displayableHueRange(0.783, 0.215, 328.1, DMIN, DMAX);
    expect(arc).not.toBeNull();
    expect(arc!.lo).toBeLessThanOrEqual(328.1);
    expect(arc!.hi).toBeGreaterThanOrEqual(328.1);
  });

  it('pinches the band to the curve hue when no hue in the window is displayable', () => {
    // interpolated (L, C) beyond the sRGB gamut for every hue in the window —
    // the band collapses onto the line so the regions never cross it
    expect(displayableHueRange(0.742, 0.271, 328.1, DMIN, DMAX)).toEqual({ lo: 328.1, hi: 328.1 });
  });

  it('clamps the arc to the scan window when every hue is displayable', () => {
    const arc = displayableHueRange(0.5, 0.02, 300, DMIN, DMAX)!;
    expect(arc.lo).toBe(DMIN);
    expect(arc.hi).toBe(DMAX);
  });

  it('bridges the nearest arc to the curve hue when the curve hue is out of gamut', () => {
    // fine-scan reference for these coordinates: arc [326.20..327.95], curve hue above it
    const arc = displayableHueRange(0.826, 0.166, 328.1, DMIN, DMAX)!;
    expect(arc.lo).toBeGreaterThan(326.0);
    expect(arc.lo).toBeLessThan(326.4);
    expect(arc.hi).toBeCloseTo(328.1, 6);
  });
});
