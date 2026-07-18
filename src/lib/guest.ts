import {createSupabaseAdminClient} from '@/lib/supabase/admin';

export const GUEST_CATEGORIES = ['essen', 'service', 'wartezeit', 'sauberkeit', 'preis'] as const;

export type GuestTable = {
  id: string;
  code: string;
  label: string;
  venue: {
    id: string;
    name: string;
    logoUrl: string | null;
    googlePlaceId: string | null;
    googleReviewUrl: string | null;
  };
};

export async function getTableByCode(code: string): Promise<GuestTable | null> {
  const supabase = createSupabaseAdminClient();
  const {data} = await supabase
    .from('tables')
    .select('id, code, label, venues (id, name, logo_url, google_place_id, google_review_url)')
    .eq('code', code)
    .maybeSingle();
  if (!data || !data.venues) return null;
  const v = data.venues as unknown as {
    id: string; name: string; logo_url: string | null;
    google_place_id: string | null; google_review_url: string | null;
  };
  return {
    id: data.id,
    code: data.code,
    label: data.label,
    venue: {
      id: v.id,
      name: v.name,
      logoUrl: v.logo_url,
      googlePlaceId: v.google_place_id,
      googleReviewUrl: v.google_review_url
    }
  };
}

export async function recordTap(tableId: string, venueId: string): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const {data, error} = await supabase
    .from('tap_events')
    .insert({table_id: tableId, venue_id: venueId})
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function setTapOutcome(
  tapId: string,
  outcome: 'google_redirect' | 'private_feedback'
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  // Only upgrade rows still at 'opened' so double submits can't rewrite history.
  await supabase.from('tap_events').update({outcome}).eq('id', tapId).eq('outcome', 'opened');
}

export async function submitFeedback(input: {
  venueId: string;
  tableId: string;
  rating: number;
  categories: string[];
  comment: string | null;
  contact: string | null;
  tapId: string | null;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const {error} = await supabase.from('feedback').insert({
    venue_id: input.venueId,
    table_id: input.tableId,
    rating: input.rating,
    categories: input.categories,
    comment: input.comment,
    contact: input.contact
  });
  if (error) throw error;
  if (input.tapId) await setTapOutcome(input.tapId, 'private_feedback');
}
