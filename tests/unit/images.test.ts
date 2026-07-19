import {describe, it, expect} from 'vitest';
import {sniffImageType} from '@/lib/images';

describe('sniffImageType', () => {
  it('detects a PNG magic-byte signature', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(sniffImageType(bytes)).toBe('png');
  });

  it('detects a JPEG magic-byte signature', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    expect(sniffImageType(bytes)).toBe('jpg');
  });

  it('returns null for HTML bytes disguised as an image', () => {
    const bytes = new TextEncoder().encode('<html');
    expect(sniffImageType(bytes)).toBeNull();
  });

  it('returns null for a buffer too short to contain a signature', () => {
    const bytes = new Uint8Array([0x89, 0x50]);
    expect(sniffImageType(bytes)).toBeNull();
  });
});
