import { describe, it, expect } from 'vitest';
import { displayableLightnessRange } from '../src/gamut';

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
