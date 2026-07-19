import {cookies} from 'next/headers';
import type {SupabaseClient} from '@supabase/supabase-js';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {slugify} from '@/lib/slug';
import {generateTableCode} from '@/lib/codes';

export const ACTIVE_VENUE_COOKIE = 'tk-venue';

export type Venue = {
  id: string;
  name: string;
  slug: string;
  googlePlaceId: string | null;
  googleReviewUrl: string | null;
  logoUrl: string | null;
};

type VenueRow = {
  id: string; name: string; slug: string;
  google_place_id: string | null; google_review_url: string | null; logo_url: string | null;
};

function toVenue(r: VenueRow): Venue {
  return {
    id: r.id, name: r.name, slug: r.slug,
    googlePlaceId: r.google_place_id,
    googleReviewUrl: r.google_review_url,
    logoUrl: r.logo_url
  };
}

const VENUE_COLS = 'id, name, slug, google_place_id, google_review_url, logo_url';

export async function getOwnerVenues(): Promise<Venue[]> {
  const supabase = await createSupabaseServerClient();
  const {data} = await supabase.from('venues').select(VENUE_COLS).order('created_at');
  return (data ?? []).map(toVenue);
}

export async function getActiveVenue(): Promise<Venue | null> {
  const venues = await getOwnerVenues();
  if (venues.length === 0) return null;
  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_VENUE_COOKIE)?.value;
  return venues.find((v) => v.id === activeId) ?? venues[0];
}

export async function createVenueWithFirstTable(
  supabase: SupabaseClient,
  ownerId: string,
  name: string
): Promise<string> {
  const slug = `${slugify(name)}-${generateTableCode().slice(0, 4)}`;
  const {data: venue, error} = await supabase
    .from('venues')
    .insert({owner_id: ownerId, name, slug})
    .select('id')
    .single();
  if (error) throw error;
  const {error: tableError} = await supabase
    .from('tables')
    .insert({venue_id: venue.id, label: 'Tisch 1', code: generateTableCode()});
  if (tableError) throw tableError;
  return venue.id;
}
