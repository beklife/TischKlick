import {describe, it, expect} from 'vitest';
import {fitWithin, MAX_IMAGE_EDGE} from '@/lib/resize';

describe('fitWithin', () => {
  it('leaves a small image alone', () => {
    expect(fitWithin(800, 600, MAX_IMAGE_EDGE)).toEqual({width: 800, height: 600});
  });

  it('scales a wide image by its width', () => {
    expect(fitWithin(4000, 2000, 1200)).toEqual({width: 1200, height: 600});
  });

  it('scales a tall image by its height', () => {
    expect(fitWithin(2000, 4000, 1200)).toEqual({width: 600, height: 1200});
  });

  it('rounds to whole pixels and never returns zero', () => {
    expect(fitWithin(3000, 1, 1200)).toEqual({width: 1200, height: 1});
  });

  it('keeps the precise rounding without the guard', () => {
    expect(fitWithin(3000, 7, 1200)).toEqual({width: 1200, height: 3});
  });

  it('handles a square image', () => {
    expect(fitWithin(2400, 2400, 1200)).toEqual({width: 1200, height: 1200});
  });
});
