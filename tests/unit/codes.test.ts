import {describe, it, expect} from 'vitest';
import {generateTableCode} from '@/lib/codes';

describe('generateTableCode', () => {
  it('returns 7 base62 chars', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateTableCode()).toMatch(/^[0-9A-Za-z]{7}$/);
    }
  });
  it('does not repeat in 1000 draws', () => {
    const seen = new Set(Array.from({length: 1000}, () => generateTableCode()));
    expect(seen.size).toBe(1000);
  });
});
