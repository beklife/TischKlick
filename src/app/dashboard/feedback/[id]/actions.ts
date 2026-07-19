'use server';

import {redirect} from 'next/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';

export async function deleteContact(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const supabase = await createSupabaseServerClient();
  // RLS: only the owning venue's owner can update.
  await supabase.from('feedback').update({contact: null}).eq('id', id);
  redirect(`/dashboard/feedback/${id}`);
}
