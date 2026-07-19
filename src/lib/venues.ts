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
  if (tableError) {
    // Cleanup-on-failure: without this, a failed table insert would leave an
    // orphaned, table-less venue behind (createVenueWithFirstTable is meant
    // to be atomic — a venue is never valid without its first table).
    await supabase.from('venues').delete().eq('id', venue.id);
    throw tableError;
  }
  return venue.id;
}

export type VenueStats = {taps: number; google: number; feedback: number; conversionPercent: number};

export async function getVenueStats(supabase: SupabaseClient, venueId: string): Promise<VenueStats> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  async function countOutcome(outcome?: 'google_redirect' | 'private_feedback'): Promise<number> {
    let query = supabase
      .from('tap_events')
      .select('id', {count: 'exact'})
      .eq('venue_id', venueId)
      .gte('created_at', since);
    if (outcome) query = query.eq('outcome', outcome);
    const {count} = await query;
    return count ?? 0;
  }

  const [taps, google, feedback] = await Promise.all([
    countOutcome(),
    countOutcome('google_redirect'),
    countOutcome('private_feedback')
  ]);

  return {
    taps,
    google,
    feedback,
    conversionPercent: taps === 0 ? 0 : Math.round(((google + feedback) / taps) * 100)
  };
}
