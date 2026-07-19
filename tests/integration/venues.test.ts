import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {createVenueWithFirstTable} from '@/lib/venues';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {auth: {persistSession: false}});

let ownerId: string;
let owner: SupabaseClient;

beforeAll(async () => {
  const email = `venues-${Date.now()}@test.local`;
  const {data, error} = await admin.auth.admin.createUser({
    email, password: 'test-passwort-123', email_confirm: true
  });
  if (error) throw error;
  ownerId = data.user.id;
  owner = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {auth: {persistSession: false}});
  await owner.auth.signInWithPassword({email, password: 'test-passwort-123'});
});

afterAll(async () => {
  await admin.auth.admin.deleteUser(ownerId);
});

describe('createVenueWithFirstTable', () => {
  it('creates venue with german slug and a first table with a valid code', async () => {
    const venueId = await createVenueWithFirstTable(owner, ownerId, 'Café Müller');
    const {data: venue} = await owner.from('venues').select('name, slug').eq('id', venueId).single();
    expect(venue!.name).toBe('Café Müller');
    expect(venue!.slug).toMatch(/^cafe-mueller-[0-9A-Za-z]{4}$/);
    const {data: tables} = await owner.from('tables').select('label, code').eq('venue_id', venueId);
    expect(tables).toHaveLength(1);
    expect(tables![0].label).toBe('Tisch 1');
    expect(tables![0].code).toMatch(/^[0-9A-Za-z]{7}$/);
  });
});
