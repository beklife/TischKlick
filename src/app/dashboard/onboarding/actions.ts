'use server';

import {redirect} from 'next/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {createVenueWithFirstTable} from '@/lib/venues';
import {googleReviewUrl, isAllowedGoogleReviewUrl} from '@/lib/google';
import {safeBackPath} from '@/lib/urls';

export async function createVenue(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim().slice(0, 120);
  if (!name) redirect('/dashboard/onboarding');
  const supabase = await createSupabaseServerClient();
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const venueId = await createVenueWithFirstTable(supabase, user.id, name);
  redirect(`/dashboard/onboarding?venue=${venueId}`);
}

// Shared by onboarding and Einstellungen: backPath decides where to return.
export async function selectPlace(formData: FormData) {
  const venueId = String(formData.get('venueId') ?? '');
  const placeId = String(formData.get('placeId') ?? '');
  const backPath = safeBackPath(formData.get('backPath'), `/dashboard/onboarding?venue=${venueId}`);
  const supabase = await createSupabaseServerClient();
  // RLS: update only succeeds if the venue belongs to the signed-in owner.
  await supabase
    .from('venues')
    .update({google_place_id: placeId, google_review_url: googleReviewUrl(placeId)})
    .eq('id', venueId);
  redirect(backPath);
}

export async function saveManualUrl(formData: FormData) {
  const venueId = String(formData.get('venueId') ?? '');
  const url = String(formData.get('url') ?? '').trim();
  const backPath = safeBackPath(formData.get('backPath'), `/dashboard/onboarding?venue=${venueId}`);
  if (!isAllowedGoogleReviewUrl(url)) {
    redirect(backPath);
  }
  const supabase = await createSupabaseServerClient();
  await supabase.from('venues').update({google_review_url: url}).eq('id', venueId);
  redirect(backPath);
}
