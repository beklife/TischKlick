import {describe, it, expect, vi, afterEach} from 'vitest';
import {googleReviewUrl, searchPlaces, PlacesApiError} from '@/lib/google';

afterEach(() => vi.unstubAllGlobals());

describe('googleReviewUrl', () => {
  it('builds the official writereview URL', () => {
    expect(googleReviewUrl('ChIJabc123')).toBe(
      'https://search.google.com/local/writereview?placeid=ChIJabc123'
    );
  });
  it('URL-encodes the place id', () => {
    expect(googleReviewUrl('a b&c')).toBe(
      'https://search.google.com/local/writereview?placeid=a%20b%26c'
    );
  });
});

describe('searchPlaces', () => {
  it('maps Places API (New) response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        places: [{
          id: 'ChIJxyz',
          displayName: {text: 'Café Sonne'},
          formattedAddress: 'Sonnenallee 1, 12045 Berlin'
        }]
      })
    }));
    const results = await searchPlaces('Café Sonne Berlin');
    expect(results).toEqual([
      {placeId: 'ChIJxyz', name: 'Café Sonne', address: 'Sonnenallee 1, 12045 Berlin'}
    ]);
  });
  it('returns [] when API finds nothing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: true, json: async () => ({})}));
    expect(await searchPlaces('gibtsnicht')).toEqual([]);
  });
  it('throws PlacesApiError on non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: false, status: 403, json: async () => ({})}));
    await expect(searchPlaces('x')).rejects.toBeInstanceOf(PlacesApiError);
  });
});
