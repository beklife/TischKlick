import {describe, it, expect} from 'vitest';
import {safeBackPath} from '@/lib/urls';

describe('safeBackPath', () => {
  it('accepts a same-site path', () => {
    expect(safeBackPath('/dashboard/einstellungen?x=1', '/fallback')).toBe(
      '/dashboard/einstellungen?x=1'
    );
  });

  it('rejects an absolute external URL', () => {
    expect(safeBackPath('https://evil.example', '/fallback')).toBe('/fallback');
  });

  it('rejects a protocol-relative URL', () => {
    expect(safeBackPath('//evil.example', '/fallback')).toBe('/fallback');
  });

  it('rejects an empty string', () => {
    expect(safeBackPath('', '/fallback')).toBe('/fallback');
  });

  it('rejects undefined', () => {
    expect(safeBackPath(undefined, '/fallback')).toBe('/fallback');
  });
});
