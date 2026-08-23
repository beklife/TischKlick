'use server';

import {redirect} from 'next/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {MAX_CUSTOM_LINKS, normalizeLinkUrl} from '@/lib/links';
import {reorderIds} from '@/lib/reorder';

const BACK = '/dashboard/linkseite';

export async function updateHubSettings(formData: FormData) {
  const venueId = String(formData.get('venueId') ?? '');
  const hubEnabled = formData.get('hubEnabled') === 'on';
  const tagline = String(formData.get('hubTagline') ?? '').trim().slice(0, 160) || null;

  const supabase = await createSupabaseServerClient();
  const {error} = await supabase
    .from('venues')
    .update({hub_enabled: hubEnabled, hub_tagline: tagline})
    .eq('id', venueId);
  if (error) console.error('updateHubSettings failed:', error);
  redirect(`${BACK}?gespeichert=1`);
}

export async function addCustomLink(formData: FormData) {
  const venueId = String(formData.get('venueId') ?? '');
  const label = String(formData.get('label') ?? '').trim().slice(0, 40);
  const icon = String(formData.get('icon') ?? '').trim().slice(0, 8) || null;
  const url = normalizeLinkUrl(formData.get('url'));
  if (!venueId || !label || !url) redirect(`${BACK}?fehler=url`);

  const supabase = await createSupabaseServerClient();
  const {count} = await supabase
    .from('venue_links')
    .select('id', {count: 'exact', head: true})
    .eq('venue_id', venueId)
    .eq('kind', 'custom');
  if ((count ?? 0) >= MAX_CUSTOM_LINKS) redirect(`${BACK}?fehler=limit`);

  const {data: last} = await supabase
    .from('venue_links')
    .select('position')
    .eq('venue_id', venueId)
    .order('position', {ascending: false})
    .limit(1)
    .maybeSingle();

  const {error} = await supabase.from('venue_links').insert({
    venue_id: venueId,
    kind: 'custom',
    label,
    icon,
    url,
    position: (last?.position ?? -1) + 1
  });
  if (error) console.error('addCustomLink failed:', error);
  redirect(`${BACK}?gespeichert=1`);
}

export async function updateCustomLink(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const label = String(formData.get('label') ?? '').trim().slice(0, 40);
  const icon = String(formData.get('icon') ?? '').trim().slice(0, 8) || null;
  const url = normalizeLinkUrl(formData.get('url'));
  if (!id || !label || !url) redirect(`${BACK}?fehler=url`);

  const supabase = await createSupabaseServerClient();
  // kind filter as well as RLS: a built-in block may never acquire a URL.
  const {error} = await supabase
    .from('venue_links')
    .update({label, icon, url})
    .eq('id', id)
    .eq('kind', 'custom');
  if (error) console.error('updateCustomLink failed:', error);
  redirect(`${BACK}?gespeichert=1`);
}

export async function updateBuiltinLink(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const label = String(formData.get('label') ?? '').trim().slice(0, 40);
  const icon = String(formData.get('icon') ?? '').trim().slice(0, 8) || null;
  if (!id || !label) redirect(`${BACK}?fehler=url`);

  const supabase = await createSupabaseServerClient();
  const {error} = await supabase
    .from('venue_links')
    .update({label, icon})
    .eq('id', id)
    .neq('kind', 'custom');
  if (error) console.error('updateBuiltinLink failed:', error);
  redirect(`${BACK}?gespeichert=1`);
}

export async function setLinkEnabled(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const enabled = String(formData.get('enabled') ?? '') === 'true';
  const supabase = await createSupabaseServerClient();
  const {error} = await supabase.from('venue_links').update({enabled}).eq('id', id);
  if (error) console.error('setLinkEnabled failed:', error);
  redirect(BACK);
}

export async function moveLink(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const venueId = String(formData.get('venueId') ?? '');
  const direction = formData.get('direction') === 'up' ? 'up' : 'down';

  const supabase = await createSupabaseServerClient();
  const {data: rows} = await supabase
    .from('venue_links')
    .select('id, position')
    .eq('venue_id', venueId);

  const ordered = (rows ?? [])
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    .map((r) => r.id);
  const next = reorderIds(ordered, id, direction);
  if (next) {
    // Renumbering the whole list, not just the swapped pair, also repairs any
    // duplicate or gapped positions left by earlier edits.
    await Promise.all(
      next.map((rid, index) =>
        supabase.from('venue_links').update({position: index}).eq('id', rid)
      )
    );
  }
  redirect(BACK);
}

export async function deleteLink(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const supabase = await createSupabaseServerClient();
  // Built-in blocks are toggled off, never deleted.
  const {error} = await supabase.from('venue_links').delete().eq('id', id).eq('kind', 'custom');
  if (error) console.error('deleteLink failed:', error);
  redirect(BACK);
}
