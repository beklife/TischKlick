import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {createClient, type SupabaseClient} from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(URL, SERVICE, {auth: {persistSession: false}});

async function makeUser(email: string): Promise<{id: string; client: SupabaseClient}> {
  const {data, error} = await admin.auth.admin.createUser({
    email,
    password: 'test-passwort-123',
    email_confirm: true
  });
  if (error) throw error;
  const client = createClient(URL, ANON, {auth: {persistSession: false}});
  const {error: signInError} = await client.auth.signInWithPassword({
    email,
    password: 'test-passwort-123'
  });
  if (signInError) throw signInError;
  return {id: data.user.id, client};
}

describe('RLS isolation', () => {
  let a: Awaited<ReturnType<typeof makeUser>>;
  let b: Awaited<ReturnType<typeof makeUser>>;
  let venueId: string;

  beforeAll(async () => {
    a = await makeUser(`rls-a-${Date.now()}@test.local`);
    b = await makeUser(`rls-b-${Date.now()}@test.local`);
  });

  afterAll(async () => {
    await admin.auth.admin.deleteUser(a.id);
    await admin.auth.admin.deleteUser(b.id);
  });

  it('signup trigger created owners rows', async () => {
    const {data} = await a.client.from('owners').select('id');
    expect(data).toHaveLength(1);
    expect(data![0].id).toBe(a.id);
  });

  it('owner A can create and read own venue', async () => {
    const {data, error} = await a.client
      .from('venues')
      .insert({owner_id: a.id, name: 'Café A', slug: `cafe-a-${Date.now()}`})
      .select('id')
      .single();
    expect(error).toBeNull();
    venueId = data!.id;
  });

  it('owner B cannot read A venue or its feedback', async () => {
    await admin.from('feedback').insert({venue_id: venueId, rating: 2, categories: ['service']});
    const {data: venues} = await b.client.from('venues').select('id').eq('id', venueId);
    expect(venues).toHaveLength(0);
    const {data: fb} = await b.client.from('feedback').select('id').eq('venue_id', venueId);
    expect(fb).toHaveLength(0);
    const {data: own} = await a.client.from('feedback').select('id').eq('venue_id', venueId);
    expect(own).toHaveLength(1);
  });

  it('owner B cannot insert a venue owned by A', async () => {
    const {error} = await b.client
      .from('venues')
      .insert({owner_id: a.id, name: 'Hack', slug: `hack-${Date.now()}`});
    expect(error).not.toBeNull();
  });

  it('anon client cannot read or write anything', async () => {
    const anon = createClient(URL, ANON, {auth: {persistSession: false}});
    const {data, error: readError} = await anon.from('feedback').select('id');
    // anon has no table grant at all, so this is a permission-denied error (data null)
    // rather than an RLS-filtered empty array — either way, no rows are ever readable.
    expect(data ?? []).toHaveLength(0);
    expect(readError).not.toBeNull();
    const {error} = await anon.from('tap_events').insert({table_id: crypto.randomUUID(), venue_id: venueId});
    expect(error).not.toBeNull();
  });
});
