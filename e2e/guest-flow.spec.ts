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
let code: string;

test.beforeAll(async () => {
  const {data, error} = await admin.auth.admin.createUser({
    email: `e2e-${Date.now()}@test.local`,
    password: 'test-passwort-123',
    email_confirm: true
  });
  if (error) throw error;
  ownerId = data.user.id;
  const {data: venue} = await admin.from('venues')
    .insert({owner_id: ownerId, name: 'E2E Café', slug: `e2e-${Date.now()}`, google_place_id: 'ChIJe2e'})
    .select('id').single();
  code = `E${Date.now().toString(36)}`.slice(0, 7).padEnd(7, 'e');
  await admin.from('tables').insert({venue_id: venue!.id, label: 'Tisch 1', code});
});

test.afterAll(async () => {
  await admin.auth.admin.deleteUser(ownerId);
});

test('negative path: 2 stars -> private feedback -> danke', async ({page}) => {
  await page.goto(`/f/${code}`);
  await expect(page.getByText('Wie war Ihr Besuch bei uns?')).toBeVisible();
  await page.getByRole('link', {name: '2 von 5 Sternen'}).click();
  await expect(page.getByText('Das tut uns leid.')).toBeVisible();
  await page.getByText('Service', {exact: true}).click();
  await page.getByLabel('Ihre Nachricht (optional)').fill('E2E: zu lange gewartet');
  await page.getByRole('button', {name: 'Feedback senden'}).click();
  // Scoped to the heading: Next.js's __next-route-announcer__ live region
  // transiently carries the same text after a client-side navigation, so an
  // unscoped getByText intermittently hits a strict-mode violation.
  await expect(page.getByRole('heading', {name: 'Vielen Dank für Ihr Feedback!'})).toBeVisible();

  const {data: fb} = await admin.from('feedback')
    .select('rating, comment, categories')
    .eq('comment', 'E2E: zu lange gewartet')
    .single();
  expect(fb).toMatchObject({rating: 2, categories: ['service']});
});

test('positive path: 5 stars -> redirected straight to google review page', async ({page}) => {
  await page.goto(`/f/${code}`);
  // Capture our own server's redirect response before the browser follows it out to
  // google.com — asserts the server-side redirect, without depending on real network.
  const redirectPromise = page.waitForResponse(
    (res) => res.url().includes(`/f/${code}/5`) && [301, 302, 307, 308].includes(res.status())
  );
  await page.getByRole('link', {name: '5 von 5 Sternen'}).click();
  const redirect = await redirectPromise;
  expect(redirect.headers()['location']).toBe('https://search.google.com/local/writereview?placeid=ChIJe2e');
});

test('unknown code shows friendly german error', async ({page}) => {
  await page.goto('/f/zzzzzzz');
  await expect(page.getByText('Dieser Link ist leider nicht mehr aktiv')).toBeVisible();
});
