'use server';

import {redirect} from 'next/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';

export async function login(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {error} = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? '')
  });
  if (error) redirect('/login?fehler=login');
  redirect('/dashboard');
}

export async function register(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {error} = await supabase.auth.signUp({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? '')
  });
  if (error) redirect('/login?fehler=register&modus=registrieren');
  redirect('/dashboard/onboarding');
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
