import {describe, it, expect} from 'vitest';
import {formatPriceCents, parsePriceInput, MAX_PRICE_CENTS} from '@/lib/money';

describe('formatPriceCents', () => {
  // Intl inserts a narrow/non-breaking space before the currency symbol,
  // and which one depends on the ICU build — match loosely on purpose.
  it('formats cents as German euros', () => {
    expect(formatPriceCents(1400)).toMatch(/^14,00\s€$/);
  });

  it('formats a sub-euro price', () => {
    expect(formatPriceCents(50)).toMatch(/^0,50\s€$/);
  });

  it('returns null for a missing price', () => {
    expect(formatPriceCents(null)).toBeNull();
    expect(formatPriceCents(undefined)).toBeNull();
  });
});

describe('parsePriceInput', () => {
  it('parses a German decimal comma', () => {
    expect(parsePriceInput('14,00')).toBe(1400);
  });

  it('parses a decimal point', () => {
    expect(parsePriceInput('14.50')).toBe(1450);
  });

  it('parses a whole number', () => {
    expect(parsePriceInput('14')).toBe(1400);
  });

  it('ignores a euro sign and surrounding whitespace', () => {
    expect(parsePriceInput(' 6,50 € ')).toBe(650);
  });

  it('treats empty input as no price', () => {
    expect(parsePriceInput('')).toBeNull();
    expect(parsePriceInput('   ')).toBeNull();
    expect(parsePriceInput(undefined)).toBeNull();
  });

  it('rejects a negative price', () => {
    expect(() => parsePriceInput('-5')).toThrow(RangeError);
  });

  it('rejects three decimal places', () => {
    expect(() => parsePriceInput('14,005')).toThrow(RangeError);
  });

  it('rejects nonsense', () => {
    expect(() => parsePriceInput('vierzehn')).toThrow(RangeError);
  });

  it('rejects a price above the cap', () => {
    expect(() => parsePriceInput('99999999')).toThrow(RangeError);
  });

  it('accepts exactly the cap', () => {
    expect(parsePriceInput('10000')).toBe(MAX_PRICE_CENTS);
  });
});
