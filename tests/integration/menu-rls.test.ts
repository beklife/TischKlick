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

describe('hub and menu isolation', () => {
  let a: Awaited<ReturnType<typeof makeUser>>;
  let b: Awaited<ReturnType<typeof makeUser>>;
  let venueA: string;
  let venueB: string;
  let categoryA: string;

  beforeAll(async () => {
    const stamp = Date.now();
    a = await makeUser(`menu-a-${stamp}@test.local`);
    b = await makeUser(`menu-b-${stamp}@test.local`);

    const {data: va} = await admin
      .from('venues')
      .insert({owner_id: a.id, name: 'Café A', slug: `menu-a-${stamp}`})
      .select('id')
      .single();
    venueA = va!.id;

    const {data: vb} = await admin
      .from('venues')
      .insert({owner_id: b.id, name: 'Café B', slug: `menu-b-${stamp}`})
      .select('id')
      .single();
    venueB = vb!.id;

    const {data: cat} = await admin
      .from('menu_categories')
      .insert({venue_id: venueA, name: 'Vorspeisen', position: 0})
      .select('id')
      .single();
    categoryA = cat!.id;

    await admin
      .from('menu_items')
      .insert({category_id: categoryA, venue_id: venueA, name: 'Bruschetta', price_cents: 650});
  });

  afterAll(async () => {
    await admin.auth.admin.deleteUser(a.id);
    await admin.auth.admin.deleteUser(b.id);
  });

  it('seeds exactly the two built-in blocks for a new venue', async () => {
    const {data} = await a.client
      .from('venue_links')
      .select('kind, label, position')
      .eq('venue_id', venueA)
      .order('position');
    expect(data).toEqual([
      {kind: 'menu', label: 'Speisekarte', position: 0},
      {kind: 'review', label: 'Bewerten', position: 1}
    ]);
  });

  it('refuses a second built-in block of the same kind', async () => {
    const {error} = await admin
      .from('venue_links')
      .insert({venue_id: venueA, kind: 'menu', label: 'Zweite Karte', position: 5});
    expect(error).not.toBeNull();
  });

  it('refuses a custom block without a URL and a menu block with one', async () => {
    const noUrl = await admin
      .from('venue_links')
      .insert({venue_id: venueA, kind: 'custom', label: 'Kaputt', position: 9});
    expect(noUrl.error).not.toBeNull();

    const {data: reviewRow} = await admin
      .from('venue_links')
      .select('id')
      .eq('venue_id', venueA)
      .eq('kind', 'review')
      .single();
    const withUrl = await admin
      .from('venue_links')
      .update({url: 'https://evil.example/'})
      .eq('id', reviewRow!.id);
    expect(withUrl.error).not.toBeNull();
  });

  it('owner B cannot read owner A’s links, categories or items', async () => {
    const links = await b.client.from('venue_links').select('id').eq('venue_id', venueA);
    const cats = await b.client.from('menu_categories').select('id').eq('venue_id', venueA);
    const items = await b.client.from('menu_items').select('id').eq('venue_id', venueA);
    expect(links.data).toEqual([]);
    expect(cats.data).toEqual([]);
    expect(items.data).toEqual([]);
  });

  it('owner B cannot write into owner A’s venue', async () => {
    const {error} = await b.client
      .from('menu_categories')
      .insert({venue_id: venueA, name: 'Fremd', position: 0});
    expect(error).not.toBeNull();
  });

  it('owner B cannot delete owner A’s category', async () => {
    await b.client.from('menu_categories').delete().eq('id', categoryA);
    const {count} = await admin
      .from('menu_categories')
      .select('id', {count: 'exact', head: true})
      .eq('id', categoryA);
    expect(count).toBe(1);
  });

  it('the composite FK blocks smuggling an item into another venue’s category', async () => {
    // venue_id passes B's RLS with-check, category_id belongs to A. Without the
    // composite foreign key this row would land in A's menu.
    const {error} = await b.client
      .from('menu_items')
      .insert({category_id: categoryA, venue_id: venueB, name: 'Schmuggelware'});
    expect(error).not.toBeNull();
    // Pin the mechanism, not just "it failed": 23503 is a foreign-key
    // violation, proving the composite FK rejected this — not RLS (which
    // would fail with 42501) or some unrelated error.
    expect(error?.code).toBe('23503');
  });

  it('anon has no privileges on the new tables', async () => {
    const anon = createClient(URL, ANON, {auth: {persistSession: false}});
    const links = await anon.from('venue_links').select('id');
    const items = await anon.from('menu_items').select('id');
    expect(links.error).not.toBeNull();
    expect(items.error).not.toBeNull();
    // 42501 is insufficient_privilege — confirms this is a grants/RLS
    // rejection, not some other failure that happens to return an error.
    expect(links.error?.code).toBe('42501');
    expect(items.error?.code).toBe('42501');
  });

  it('deleting a category cascades its items away', async () => {
    const {data: cat} = await admin
      .from('menu_categories')
      .insert({venue_id: venueB, name: 'Weg damit', position: 0})
      .select('id')
      .single();
    await admin
      .from('menu_items')
      .insert({category_id: cat!.id, venue_id: venueB, name: 'Fällt mit'});
    await admin.from('menu_categories').delete().eq('id', cat!.id);
    const {count} = await admin
      .from('menu_items')
      .select('id', {count: 'exact', head: true})
      .eq('category_id', cat!.id);
    expect(count).toBe(0);
  });
});
