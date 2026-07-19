'use server';

import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {ACTIVE_VENUE_COOKIE} from '@/lib/venues';

export async function switchVenue(formData: FormData) {
  const venueId = String(formData.get('venueId') ?? '');
  const cookieStore = await cookies();
  // Unvalidated is safe here: getActiveVenue only matches this cookie against
  // the signed-in owner's own RLS-scoped venues, so a tampered value just
  // falls back to the owner's first venue — it can never select another
  // owner's data.
  cookieStore.set(ACTIVE_VENUE_COOKIE, venueId, {httpOnly: true, sameSite: 'lax', path: '/'});
  redirect('/dashboard');
}
