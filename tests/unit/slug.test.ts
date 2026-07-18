import {describe, it, expect} from 'vitest';
import {slugify} from '@/lib/slug';

describe('slugify', () => {
  it('transliterates German umlauts', () => {
    expect(slugify('Café Müller & Söhne')).toBe('cafe-mueller-soehne');
    expect(slugify('Weißes Rößl')).toBe('weisses-roessl');
  });
  it('collapses and trims separators', () => {
    expect(slugify('  Zum  Goldenen   Hirsch  ')).toBe('zum-goldenen-hirsch');
  });
  it('never returns empty for junk input', () => {
    expect(slugify('!!!')).toMatch(/^venue$/);
  });
});
