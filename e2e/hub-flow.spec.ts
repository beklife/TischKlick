import {test, expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({path: '.env.local'});

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {auth: {persistSession: false}}
);

let ownerId: string;
let hubTableId: string;
let hubCode: string;
let plainCode: string;

// A failed insert doesn't throw with supabase-js — it returns {data: null, error}.
// Left unchecked, that surfaces later as a confusing "element not found" locator
// timeout (e.g. a missing Speisekarte button) instead of naming the real cause.
// This fails loudly with the actual PostgREST error message instead.
function must<T>(result: {data: T | null; error: {message: string} | null}, what: string): T {
  if (result.error) throw new Error(`fixture: ${what} failed — ${result.error.message}`);
  if (!result.data) throw new Error(`fixture: ${what} returned no row`);
  return result.data;
}

test.beforeAll(async () => {
  const stamp = Date.now();
  const {data, error} = await admin.auth.admin.createUser({
    email: `e2e-hub-${stamp}@test.local`,
    password: 'test-passwort-123',
    email_confirm: true
  });
  if (error) throw error;
  ownerId = data.user.id;

  // Venue with the hub switched on and a one-item menu.
  const hubVenue = must<{id: string}>(
    await admin
      .from('venues')
      .insert({
        owner_id: ownerId,
        name: 'Hub Café',
        slug: `e2e-hub-${stamp}`,
        google_place_id: 'ChIJhub',
        hub_enabled: true,
        hub_tagline: 'Frisch geröstet'
      })
      .select('id')
      .single(),
    'hubVenue insert'
  );

  hubCode = `H${stamp.toString(36)}`.slice(0, 7).padEnd(7, 'h');
  const hubTable = must<{id: string}>(
    await admin
      .from('tables')
      .insert({venue_id: hubVenue.id, label: 'Tisch 1', code: hubCode})
      .select('id')
      .single(),
    'hubTable insert'
  );
  hubTableId = hubTable.id;

  const category = must<{id: string}>(
    await admin
      .from('menu_categories')
      .insert({venue_id: hubVenue.id, name: 'Vorspeisen', position: 0})
      .select('id')
      .single(),
    'category insert'
  );
  const {error: itemError} = await admin.from('menu_items').insert({
    category_id: category.id,
    venue_id: hubVenue.id,
    name: 'Bruschetta',
    description: 'Tomate, Basilikum',
    price_cents: 650,
    allergens: ['a', 'g'],
    diet_tags: ['vegetarisch'],
    position: 0
  });
  if (itemError) throw new Error(`fixture: menu_items insert failed — ${itemError.message}`);

  // Second venue with the hub off — the regression guard.
  const plainVenue = must<{id: string}>(
    await admin
      .from('venues')
      .insert({owner_id: ownerId, name: 'Klassik Café', slug: `e2e-plain-${stamp}`})
      .select('id')
      .single(),
    'plainVenue insert'
  );
  plainCode = `P${stamp.toString(36)}`.slice(0, 7).padEnd(7, 'p');
  const {error: plainTableError} = await admin
    .from('tables')
    .insert({venue_id: plainVenue.id, label: 'Tisch 1', code: plainCode});
  if (plainTableError) {
    throw new Error(`fixture: plainTable insert failed — ${plainTableError.message}`);
  }
});

test.afterAll(async () => {
  await admin.auth.admin.deleteUser(ownerId);
});

test('hub → menu → back → rate reaches the private feedback form', async ({page}) => {
  await page.goto(`/f/${hubCode}`);
  await expect(page.getByRole('heading', {name: 'Hub Café'})).toBeVisible();
  await expect(page.getByText('Frisch geröstet')).toBeVisible();

  await page.getByRole('link', {name: /Speisekarte/}).click();
  await expect(page.getByRole('heading', {name: 'Speisekarte'})).toBeVisible();
  await expect(page.getByText('Bruschetta')).toBeVisible();
  await expect(page.getByText(/6,50/)).toBeVisible();
  await expect(page.getByText('a Glutenhaltiges Getreide · g Milch/Laktose')).toBeVisible();

  await page.getByRole('link', {name: 'Zurück'}).click();
  await page.getByRole('link', {name: /Bewerten/}).click();
  await page.getByRole('link', {name: '2 von 5 Sternen'}).click();
  await expect(page.getByText('Das tut uns leid.')).toBeVisible();
});

test('the whole hub journey counts as a single tap', async ({page}) => {
  const before = await admin
    .from('tap_events')
    .select('id', {count: 'exact', head: true})
    .eq('table_id', hubTableId);

  await page.goto(`/f/${hubCode}`);
  await page.getByRole('link', {name: /Speisekarte/}).click();
  await page.getByRole('link', {name: 'Zurück'}).click();
  await page.getByRole('link', {name: /Bewerten/}).click();

  const after = await admin
    .from('tap_events')
    .select('id', {count: 'exact', head: true})
    .eq('table_id', hubTableId);
  expect((after.count ?? 0) - (before.count ?? 0)).toBe(1);
});

test('the menu view is recorded on the tap event', async ({page}) => {
  await page.goto(`/f/${hubCode}`);
  await page.getByRole('link', {name: /Speisekarte/}).click();
  await expect(page.getByText('Bruschetta')).toBeVisible();

  const {count} = await admin
    .from('tap_events')
    .select('id', {count: 'exact', head: true})
    .eq('table_id', hubTableId)
    .not('menu_viewed_at', 'is', null);
  expect(count ?? 0).toBeGreaterThan(0);
});

test('a venue without the hub still lands straight on the stars', async ({page}) => {
  await page.goto(`/f/${plainCode}`);
  await expect(page.getByText('Wie war Ihr Besuch bei uns?')).toBeVisible();
});
