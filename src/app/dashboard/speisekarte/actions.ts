'use server';

import {redirect} from 'next/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
import {reorderIds} from '@/lib/reorder';

const BACK = '/dashboard/speisekarte';

export async function addCategory(formData: FormData) {
  const venueId = String(formData.get('venueId') ?? '');
  const name = String(formData.get('name') ?? '').trim().slice(0, 60);
  if (venueId && name) {
    const supabase = await createSupabaseServerClient();
    const {data: last} = await supabase
      .from('menu_categories')
      .select('position')
      .eq('venue_id', venueId)
      .order('position', {ascending: false})
      .limit(1)
      .maybeSingle();
    const {error} = await supabase
      .from('menu_categories')
      .insert({venue_id: venueId, name, position: (last?.position ?? -1) + 1});
    if (error) console.error('addCategory failed:', error);
  }
  redirect(BACK);
}

export async function renameCategory(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim().slice(0, 60);
  if (id && name) {
    const supabase = await createSupabaseServerClient();
    const {error} = await supabase.from('menu_categories').update({name}).eq('id', id);
    if (error) console.error('renameCategory failed:', error);
  }
  redirect(BACK);
}

export async function moveCategory(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const venueId = String(formData.get('venueId') ?? '');
  const direction = formData.get('direction') === 'up' ? 'up' : 'down';

  const supabase = await createSupabaseServerClient();
  const {data: rows} = await supabase
    .from('menu_categories')
    .select('id, position')
    .eq('venue_id', venueId);

  const ordered = (rows ?? [])
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    .map((r) => r.id);
  const next = reorderIds(ordered, id, direction);
  if (next) {
    await Promise.all(
      next.map((rid, index) =>
        supabase.from('menu_categories').update({position: index}).eq('id', rid)
      )
    );
  }
  redirect(BACK);
}

export async function deleteCategory(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const supabase = await createSupabaseServerClient();

  // The `on delete cascade` removes the item rows but knows nothing about
  // Storage, so the photos have to go first or they are orphaned forever.
  // Reading via the RLS client first establishes ownership before the
  // service-role client ever touches Storage.
  const {data: items} = await supabase
    .from('menu_items')
    .select('id, venue_id')
    .eq('category_id', id);
  if (items && items.length > 0) {
    const admin = createSupabaseAdminClient();
    const paths = items.flatMap((i) => [
      `${i.venue_id}/${i.id}.png`,
      `${i.venue_id}/${i.id}.jpg`
    ]);
    const {error: storageError} = await admin.storage.from('menu-images').remove(paths);
    // Best effort: a leftover file is cheaper than a delete the owner cannot complete.
    if (storageError) console.error('deleteCategory storage cleanup failed:', storageError);
  }

  const {error} = await supabase.from('menu_categories').delete().eq('id', id);
  if (error) console.error('deleteCategory failed:', error);
  redirect(BACK);
}
