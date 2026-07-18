import {describe, it, expect} from 'vitest';
import {ratingBranch} from '@/lib/rating';

describe('ratingBranch', () => {
  it('sends 1-3 to private', () => {
    expect(ratingBranch(1)).toBe('private');
    expect(ratingBranch(2)).toBe('private');
    expect(ratingBranch(3)).toBe('private');
  });
  it('sends 4-5 to google', () => {
    expect(ratingBranch(4)).toBe('google');
    expect(ratingBranch(5)).toBe('google');
  });
  it('rejects invalid ratings', () => {
    for (const bad of [0, 6, 2.5, NaN, -1]) {
      expect(() => ratingBranch(bad)).toThrow(RangeError);
    }
  });
});
