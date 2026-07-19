import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {createClient} from '@supabase/supabase-js';
import {getVenueStats} from '@/lib/venues';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {auth: {persistSession: false, autoRefreshToken: false}}
);

let ownerId: string;
let venueId: string;
let tableId: string;

beforeAll(async () => {
  const {data, error} = await admin.auth.admin.createUser({
    email: `stats-${Date.now()}@test.local`,
    password: 'test-passwort-123',
    email_confirm: true
  });
  if (error) throw error;
  ownerId = data.user.id;
  const {data: venue} = await admin.from('venues')
    .insert({owner_id: ownerId, name: 'Statscafé', slug: `stats-${Date.now()}`})
    .select('id').single();
  venueId = venue!.id;
  const {data: table} = await admin.from('tables')
    .insert({venue_id: venueId, label: 'Tisch 1', code: `S${Date.now().toString(36)}`.slice(0, 7).padEnd(7, 's')})
    .select('id').single();
  tableId = table!.id;

  const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
  const nowDate = new Date().toISOString();
  await admin.from('tap_events').insert([
    {table_id: tableId, venue_id: venueId, outcome: 'opened', created_at: nowDate},
    {table_id: tableId, venue_id: venueId, outcome: 'opened', created_at: nowDate},
    {table_id: tableId, venue_id: venueId, outcome: 'google_redirect', created_at: nowDate},
    {table_id: tableId, venue_id: venueId, outcome: 'google_redirect', created_at: nowDate},
    {table_id: tableId, venue_id: venueId, outcome: 'private_feedback', created_at: nowDate},
    {table_id: tableId, venue_id: venueId, outcome: 'opened', created_at: oldDate} // outside window
  ]);
});

afterAll(async () => {
  await admin.auth.admin.deleteUser(ownerId);
});

describe('getVenueStats', () => {
  it('counts taps and outcomes within 30 days', async () => {
    const stats = await getVenueStats(admin, venueId);
    expect(stats).toEqual({taps: 5, google: 2, feedback: 1, conversionPercent: 60});
  });

  it('returns zeros for a venue without taps', async () => {
    const {data: empty} = await admin.from('venues')
      .insert({owner_id: ownerId, name: 'Leer', slug: `leer-${Date.now()}`})
      .select('id').single();
    const stats = await getVenueStats(admin, empty!.id);
    expect(stats).toEqual({taps: 0, google: 0, feedback: 0, conversionPercent: 0});
  });
});
