'use server';

import {redirect} from 'next/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {generateTableCode} from '@/lib/codes';

export async function addTable(formData: FormData) {
  const venueId = String(formData.get('venueId') ?? '');
  const label = String(formData.get('label') ?? '').trim().slice(0, 60);
  if (venueId && label) {
    const supabase = await createSupabaseServerClient();
    // RLS with check: insert only succeeds for the owner's venue.
    const {error} = await supabase.from('tables').insert({venue_id: venueId, label, code: generateTableCode()});
    if (error) console.error('addTable failed:', error);
  }
  redirect('/dashboard/tische');
}

export async function deleteTable(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const supabase = await createSupabaseServerClient();
  const {error} = await supabase.from('tables').delete().eq('id', id);
  if (error) console.error('deleteTable failed:', error);
  redirect('/dashboard/tische');
}
