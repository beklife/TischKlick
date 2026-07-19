'use server';

import {redirect} from 'next/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';

export async function updateVenueName(formData: FormData) {
  const venueId = String(formData.get('venueId') ?? '');
  const name = String(formData.get('name') ?? '').trim().slice(0, 120);
  if (name) {
    const supabase = await createSupabaseServerClient();
    const {error} = await supabase.from('venues').update({name}).eq('id', venueId);
    if (error) console.error('updateVenueName failed:', error);
  }
  redirect('/dashboard/einstellungen?gespeichert=1');
}

const ALLOWED_LOGO_TYPES: Record<string, string> = {'image/png': 'png', 'image/jpeg': 'jpg'};
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export async function uploadLogo(formData: FormData) {
  const venueId = String(formData.get('venueId') ?? '');
  const file = formData.get('logo');
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_LOGO_BYTES) {
    redirect('/dashboard/einstellungen');
  }
  const ext = ALLOWED_LOGO_TYPES[file.type];
  if (!ext) redirect('/dashboard/einstellungen');

  // Ownership check with the user client (RLS) BEFORE touching storage with service role.
  const supabase = await createSupabaseServerClient();
  const {data: venue} = await supabase.from('venues').select('id').eq('id', venueId).maybeSingle();
  if (!venue) redirect('/dashboard/einstellungen');

  const admin = createSupabaseAdminClient();
  const path = `${venueId}/logo.${ext}`;
  const {error} = await admin.storage.from('logos').upload(path, file, {upsert: true, contentType: file.type});
  if (!error) {
    const {data: pub} = admin.storage.from('logos').getPublicUrl(path);
    const {error: updateError} = await supabase.from('venues').update({logo_url: pub.publicUrl}).eq('id', venueId);
    if (updateError) console.error('uploadLogo failed:', updateError);
  }
  redirect('/dashboard/einstellungen?gespeichert=1');
}
