import {describe, it, expect} from 'vitest';
import {normalizeLinkUrl} from '@/lib/links';

describe('normalizeLinkUrl', () => {
  it('passes an https URL through', () => {
    expect(normalizeLinkUrl('https://instagram.com/cafesonne')).toBe(
      'https://instagram.com/cafesonne'
    );
  });

  it('prepends https to a scheme-less host', () => {
    expect(normalizeLinkUrl('wa.me/4930123')).toBe('https://wa.me/4930123');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeLinkUrl('  cafe-sonne.de  ')).toBe('https://cafe-sonne.de/');
  });

  it('accepts a mailto address', () => {
    expect(normalizeLinkUrl('mailto:info@cafe-sonne.de')).toBe('mailto:info@cafe-sonne.de');
  });

  it('accepts a tel number and strips its formatting', () => {
    expect(normalizeLinkUrl('tel:+49 30 1234567')).toBe('tel:+49301234567');
  });

  it('rejects javascript:', () => {
    expect(normalizeLinkUrl('javascript:alert(1)')).toBeNull();
  });

  it('rejects javascript: hidden by leading whitespace and mixed case', () => {
    expect(normalizeLinkUrl('  JaVaScRiPt:alert(1)')).toBeNull();
  });

  it('rejects data: URLs', () => {
    expect(normalizeLinkUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
  });

  it('strips userinfo so the displayed host cannot be spoofed', () => {
    expect(normalizeLinkUrl('https://google.com@evil.com')).toBe('https://evil.com/');
  });

  it('rejects a protocol-relative URL', () => {
    expect(normalizeLinkUrl('//evil.example')).toBeNull();
  });

  it('rejects plain http', () => {
    expect(normalizeLinkUrl('http://cafe-sonne.de')).toBeNull();
  });

  it('rejects a host without a dot', () => {
    expect(normalizeLinkUrl('localhost')).toBeNull();
  });

  it('rejects an over-long URL', () => {
    expect(normalizeLinkUrl(`https://x.de/${'a'.repeat(600)}`)).toBeNull();
  });

  it('rejects empty and non-string input', () => {
    expect(normalizeLinkUrl('')).toBeNull();
    expect(normalizeLinkUrl('   ')).toBeNull();
    expect(normalizeLinkUrl(undefined)).toBeNull();
    expect(normalizeLinkUrl(42)).toBeNull();
  });
});
