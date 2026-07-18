export type PlaceResult = {placeId: string; name: string; address: string};

export class PlacesApiError extends Error {
  constructor(status: number) {
    super(`Places API antwortete mit Status ${status}`);
    this.name = 'PlacesApiError';
  }
}

export function googleReviewUrl(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

type PlacesResponse = {
  places?: Array<{
    id: string;
    displayName?: {text?: string};
    formattedAddress?: string;
  }>;
};

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY!,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress'
    },
    body: JSON.stringify({textQuery: query, regionCode: 'DE', languageCode: 'de'})
  });
  if (!res.ok) throw new PlacesApiError(res.status);
  const data = (await res.json()) as PlacesResponse;
  return (data.places ?? []).map((p) => ({
    placeId: p.id,
    name: p.displayName?.text ?? '',
    address: p.formattedAddress ?? ''
  }));
}
