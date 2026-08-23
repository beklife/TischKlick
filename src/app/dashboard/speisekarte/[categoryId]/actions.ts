'use server';

import {redirect} from 'next/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
import {sniffImageType} from '@/lib/images';
import {parsePriceInput} from '@/lib/money';
import {filterAdditives, filterAllergens, filterDietTags} from '@/lib/menu';
import {reorderIds} from '@/lib/reorder';

const ALLOWED_ITEM_IMAGE_TYPES: Record<string, string> = {'image/png': 'png', 'image/jpeg': 'jpg'};
const MAX_ITEM_IMAGE_BYTES = 3 * 1024 * 1024;

function backTo(categoryId: string, query = ''): string {
  return `/dashboard/speisekarte/${categoryId}${query}`;
}

// Filtering here — not just at render time — is the write-side defence: the
// DB columns are plain text[] with no CHECK constraint, and the guest menu
// renders diet tags through t(`diet.${tag}`), so an unfiltered value reaching
// the database would render as a raw i18n key on a guest's screen.
function readItemFields(formData: FormData) {
  return {
    name: String(formData.get('name') ?? '').trim().slice(0, 120),
    description: String(formData.get('description') ?? '').trim().slice(0, 400) || null,
    diet_tags: filterDietTags(formData.getAll('dietTags')),
    allergens: filterAllergens(formData.getAll('allergens')),
    additives: filterAdditives(formData.getAll('additives')),
    sold_out: formData.get('soldOut') === 'on'
  };
}

export async function addMenuItem(formData: FormData) {
  const categoryId = String(formData.get('categoryId') ?? '');
  const venueId = String(formData.get('venueId') ?? '');
  const fields = readItemFields(formData);
  if (!categoryId || !venueId || !fields.name) redirect(backTo(categoryId, '?fehler=name'));

  // redirect() throws, so it must live in the catch, never inside the try.
  let priceCents: number | null;
  try {
    priceCents = parsePriceInput(formData.get('price'));
  } catch {
    redirect(backTo(categoryId, '?fehler=preis'));
  }

  const supabase = await createSupabaseServerClient();
  const {data: last} = await supabase
    .from('menu_items')
    .select('position')
    .eq('category_id', categoryId)
    .order('position', {ascending: false})
    .limit(1)
    .maybeSingle();

  const {error} = await supabase.from('menu_items').insert({
    category_id: categoryId,
    venue_id: venueId,
    ...fields,
    price_cents: priceCents,
    position: (last?.position ?? -1) + 1
  });
  if (error) console.error('addMenuItem failed:', error);
  redirect(backTo(categoryId, '?gespeichert=1'));
}

export async function updateMenuItem(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const categoryId = String(formData.get('categoryId') ?? '');
  const fields = readItemFields(formData);
  if (!id || !fields.name) redirect(backTo(categoryId, '?fehler=name'));

  let priceCents: number | null;
  try {
    priceCents = parsePriceInput(formData.get('price'));
  } catch {
    redirect(backTo(categoryId, '?fehler=preis'));
  }

  const supabase = await createSupabaseServerClient();
  const {error} = await supabase
    .from('menu_items')
    .update({...fields, price_cents: priceCents})
    .eq('id', id);
  if (error) console.error('updateMenuItem failed:', error);
  redirect(backTo(categoryId, '?gespeichert=1'));
}

export async function moveMenuItem(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const categoryId = String(formData.get('categoryId') ?? '');
  const direction = formData.get('direction') === 'up' ? 'up' : 'down';

  const supabase = await createSupabaseServerClient();
  const {data: rows} = await supabase
    .from('menu_items')
    .select('id, position')
    .eq('category_id', categoryId);

  const ordered = (rows ?? [])
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    .map((r) => r.id);
  const next = reorderIds(ordered, id, direction);
  if (next) {
    await Promise.all(
      next.map((rid, index) =>
        supabase.from('menu_items').update({position: index}).eq('id', rid)
      )
    );
  }
  redirect(backTo(categoryId));
}

export async function deleteMenuItem(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const categoryId = String(formData.get('categoryId') ?? '');

  const supabase = await createSupabaseServerClient();
  const {data: item} = await supabase
    .from('menu_items')
    .select('id, venue_id')
    .eq('id', id)
    .maybeSingle();

  if (item) {
    const admin = createSupabaseAdminClient();
    const {error: storageError} = await admin.storage
      .from('menu-images')
      .remove([`${item.venue_id}/${id}.png`, `${item.venue_id}/${id}.jpg`]);
    if (storageError) console.error('deleteMenuItem storage cleanup failed:', storageError);

    const {error} = await supabase.from('menu_items').delete().eq('id', id);
    if (error) console.error('deleteMenuItem failed:', error);
  }
  redirect(backTo(categoryId));
}

export async function uploadItemImage(formData: FormData) {
  const itemId = String(formData.get('itemId') ?? '');
  const categoryId = String(formData.get('categoryId') ?? '');
  const file = formData.get('photo');

  if (!(file instanceof File) || file.size === 0 || file.size > MAX_ITEM_IMAGE_BYTES) {
    redirect(backTo(categoryId, '?fehler=foto'));
  }
  const ext = ALLOWED_ITEM_IMAGE_TYPES[file.type];
  if (!ext) redirect(backTo(categoryId, '?fehler=foto'));

  // Never trust the declared MIME type: check the real leading bytes.
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (sniffImageType(head) !== ext) redirect(backTo(categoryId, '?fehler=foto'));

  // Ownership through the RLS client BEFORE the service-role client touches Storage.
  const supabase = await createSupabaseServerClient();
  const {data: item} = await supabase
    .from('menu_items')
    .select('id, venue_id')
    .eq('id', itemId)
    .maybeSingle();
  if (!item) redirect(backTo(categoryId, '?fehler=foto'));

  const admin = createSupabaseAdminClient();
  // Remove both extensions first, so a JPG replacing a PNG cannot orphan the old file.
  await admin.storage
    .from('menu-images')
    .remove([`${item.venue_id}/${itemId}.png`, `${item.venue_id}/${itemId}.jpg`]);

  const path = `${item.venue_id}/${itemId}.${ext}`;
  const {error} = await admin.storage
    .from('menu-images')
    .upload(path, file, {upsert: true, contentType: file.type});
  if (error) {
    console.error('uploadItemImage failed:', error);
    redirect(backTo(categoryId, '?fehler=foto'));
  }

  const {data: pub} = admin.storage.from('menu-images').getPublicUrl(path);
  // Cache-bust: the path is reused on re-upload, so a version param forces refetch.
  const {error: updateError} = await supabase
    .from('menu_items')
    .update({image_url: `${pub.publicUrl}?v=${Date.now()}`})
    .eq('id', itemId);
  if (updateError) console.error('uploadItemImage update failed:', updateError);
  redirect(backTo(categoryId, '?gespeichert=1'));
}

export async function removeItemImage(formData: FormData) {
  const itemId = String(formData.get('itemId') ?? '');
  const categoryId = String(formData.get('categoryId') ?? '');

  const supabase = await createSupabaseServerClient();
  const {data: item} = await supabase
    .from('menu_items')
    .select('id, venue_id')
    .eq('id', itemId)
    .maybeSingle();
  if (item) {
    const admin = createSupabaseAdminClient();
    const {error: storageError} = await admin.storage
      .from('menu-images')
      .remove([`${item.venue_id}/${itemId}.png`, `${item.venue_id}/${itemId}.jpg`]);
    if (storageError) console.error('removeItemImage storage cleanup failed:', storageError);
    const {error} = await supabase.from('menu_items').update({image_url: null}).eq('id', itemId);
    if (error) console.error('removeItemImage failed:', error);
  }
  redirect(backTo(categoryId));
}
