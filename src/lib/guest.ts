import {createSupabaseAdminClient} from '@/lib/supabase/admin';

export const GUEST_CATEGORIES = ['essen', 'service', 'wartezeit', 'sauberkeit', 'preis'] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function cleanTapId(value: unknown): string | null {
  return typeof value === 'string' && UUID_RE.test(value) ? value : null;
}

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
    hubEnabled: boolean;
    hubTagline: string | null;
  };
};

export async function getTableByCode(code: string): Promise<GuestTable | null> {
  const supabase = createSupabaseAdminClient();
  const {data, error} = await supabase
    .from('tables')
    .select(
      'id, code, label, venues (id, name, logo_url, google_place_id, google_review_url, hub_enabled, hub_tagline)'
    )
    .eq('code', code)
    .maybeSingle();
  // With .maybeSingle(), "no rows" is data: null, error: null — not an error.
  // A real error here is a genuine DB/network failure and must not be swallowed
  // as if the table code were simply invalid.
  if (error) throw error;
  if (!data || !data.venues) return null;
  const v = data.venues as unknown as {
    id: string; name: string; logo_url: string | null;
    google_place_id: string | null; google_review_url: string | null;
    hub_enabled: boolean; hub_tagline: string | null;
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
      googleReviewUrl: v.google_review_url,
      hubEnabled: v.hub_enabled,
      hubTagline: v.hub_tagline
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
  const {error} = await supabase
    .from('tap_events')
    .update({outcome})
    .eq('id', tapId)
    .eq('outcome', 'opened');
  // Outcome tracking is analytics, not the guest flow: never throw here. In particular,
  // submitFeedback calls this after the feedback row is already saved, so throwing would
  // push the guest into resubmitting and creating duplicate feedback.
  if (error) console.error('setTapOutcome failed:', error);
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

export async function markMenuViewed(tapId: string, tableId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  // Scoped to the tap's own table so a guessed/forged ?t= cannot stamp a
  // stranger's row, and idempotent so a reload does not move the timestamp.
  const {error} = await supabase
    .from('tap_events')
    .update({menu_viewed_at: new Date().toISOString()})
    .eq('id', tapId)
    .eq('table_id', tableId)
    .is('menu_viewed_at', null);
  // Analytics, not the guest flow: never throw. Same rule as setTapOutcome.
  if (error) console.error('markMenuViewed failed:', error);
}
