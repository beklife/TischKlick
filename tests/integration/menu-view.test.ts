import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {createClient} from '@supabase/supabase-js';
import {markMenuViewed, getTableByCode} from '@/lib/guest';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {auth: {persistSession: false, autoRefreshToken: false}}
);

let ownerId: string;
let venueId: string;
let tableId: string;
let otherTableId: string;
let code: string;

beforeAll(async () => {
  const stamp = Date.now();
  const {data, error} = await admin.auth.admin.createUser({
    email: `menuview-${stamp}@test.local`,
    password: 'test-passwort-123',
    email_confirm: true
  });
  if (error) throw error;
  ownerId = data.user.id;

  const {data: venue} = await admin
    .from('venues')
    .insert({
      owner_id: ownerId,
      name: 'Hub Café',
      slug: `hub-${stamp}`,
      hub_enabled: true,
      hub_tagline: 'Frisch geröstet seit 1998'
    })
    .select('id')
    .single();
  venueId = venue!.id;

  code = `M${stamp.toString(36)}`.slice(0, 7).padEnd(7, 'm');
  const {data: table} = await admin
    .from('tables')
    .insert({venue_id: venueId, label: 'Tisch 1', code})
    .select('id')
    .single();
  tableId = table!.id;

  const {data: other} = await admin
    .from('tables')
    .insert({venue_id: venueId, label: 'Tisch 2', code: `${code.slice(0, 6)}x`})
    .select('id')
    .single();
  otherTableId = other!.id;
});

afterAll(async () => {
  await admin.auth.admin.deleteUser(ownerId);
});

describe('getTableByCode', () => {
  it('exposes the venue hub configuration', async () => {
    const table = await getTableByCode(code);
    expect(table!.venue.hubEnabled).toBe(true);
    expect(table!.venue.hubTagline).toBe('Frisch geröstet seit 1998');
  });
});

describe('markMenuViewed', () => {
  it('stamps the tap event once', async () => {
    const {data: tap} = await admin
      .from('tap_events')
      .insert({table_id: tableId, venue_id: venueId})
      .select('id')
      .single();

    await markMenuViewed(tap!.id, tableId);
    const {data: first} = await admin
      .from('tap_events')
      .select('menu_viewed_at')
      .eq('id', tap!.id)
      .single();
    expect(first!.menu_viewed_at).not.toBeNull();

    // A second visit must not move the timestamp.
    await markMenuViewed(tap!.id, tableId);
    const {data: second} = await admin
      .from('tap_events')
      .select('menu_viewed_at')
      .eq('id', tap!.id)
      .single();
    expect(second!.menu_viewed_at).toBe(first!.menu_viewed_at);
  });

  it('ignores a tap id that belongs to a different table', async () => {
    const {data: tap} = await admin
      .from('tap_events')
      .insert({table_id: otherTableId, venue_id: venueId})
      .select('id')
      .single();

    await markMenuViewed(tap!.id, tableId);
    const {data: row} = await admin
      .from('tap_events')
      .select('menu_viewed_at')
      .eq('id', tap!.id)
      .single();
    expect(row!.menu_viewed_at).toBeNull();
  });

  it('does not throw on an unknown tap id', async () => {
    await expect(
      markMenuViewed('00000000-0000-0000-0000-000000000000', tableId)
    ).resolves.toBeUndefined();
  });
});
