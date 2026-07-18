'use server';

import {redirect} from 'next/navigation';
import {getTableByCode, setTapOutcome, submitFeedback, GUEST_CATEGORIES} from '@/lib/guest';
import {ratingBranch} from '@/lib/rating';
import {googleReviewUrl} from '@/lib/google';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanTapId(value: FormDataEntryValue | null): string | null {
  return typeof value === 'string' && UUID_RE.test(value) ? value : null;
}

export async function goToGoogle(formData: FormData) {
  const code = String(formData.get('code') ?? '');
  const tapId = cleanTapId(formData.get('tapId'));
  const table = await getTableByCode(code);
  if (!table) redirect('/f/ungueltig');
  const url =
    table.venue.googleReviewUrl ??
    (table.venue.googlePlaceId ? googleReviewUrl(table.venue.googlePlaceId) : null);
  if (!url) redirect(`/f/${code}/danke`);
  if (tapId) await setTapOutcome(tapId, 'google_redirect');
  redirect(url);
}

export async function sendFeedback(formData: FormData) {
  const code = String(formData.get('code') ?? '');
  const tapId = cleanTapId(formData.get('tapId'));
  const rating = Number(formData.get('rating'));
  const table = await getTableByCode(code);
  if (!table) redirect('/f/ungueltig');

  let branch: 'google' | 'private';
  try {
    branch = ratingBranch(rating);
  } catch {
    redirect(`/f/${code}`);
  }
  if (branch !== 'private') redirect(`/f/${code}/${rating}${tapId ? `?t=${tapId}` : ''}`);

  const categories = formData
    .getAll('categories')
    .filter((c): c is string => typeof c === 'string')
    .filter((c) => (GUEST_CATEGORIES as readonly string[]).includes(c));
  const comment = String(formData.get('comment') ?? '').trim().slice(0, 2000) || null;
  const contact = String(formData.get('contact') ?? '').trim().slice(0, 200) || null;

  try {
    await submitFeedback({
      venueId: table.venue.id,
      tableId: table.id,
      rating,
      categories,
      comment,
      contact,
      tapId
    });
  } catch {
    const params = new URLSearchParams({fehler: '1'});
    if (tapId) params.set('t', tapId);
    if (comment) params.set('k', comment);
    if (contact) params.set('c', contact);
    if (categories.length) params.set('cat', categories.join(','));
    redirect(`/f/${code}/${rating}?${params.toString()}`);
  }
  redirect(`/f/${code}/danke`);
}
