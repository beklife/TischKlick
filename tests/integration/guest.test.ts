import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {createClient} from '@supabase/supabase-js';
import {getTableByCode, recordTap, setTapOutcome, submitFeedback} from '@/lib/guest';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {auth: {persistSession: false}}
);

let ownerId: string;
let venueId: string;
let tableId: string;
const code = `T${Date.now().toString(36)}`.slice(0, 7).padEnd(7, 'x');

beforeAll(async () => {
  const {data: user, error} = await admin.auth.admin.createUser({
    email: `guest-ops-${Date.now()}@test.local`,
    password: 'test-passwort-123',
    email_confirm: true
  });
  if (error) throw error;
  ownerId = user.user.id;
  const {data: venue} = await admin
    .from('venues')
    .insert({owner_id: ownerId, name: 'Testcafé', slug: `testcafe-${Date.now()}`, google_place_id: 'ChIJtest'})
    .select('id')
    .single();
  venueId = venue!.id;
  const {data: table} = await admin
    .from('tables')
    .insert({venue_id: venueId, label: 'Tisch 1', code})
    .select('id')
    .single();
  tableId = table!.id;
});

afterAll(async () => {
  await admin.auth.admin.deleteUser(ownerId); // cascades owners -> venues -> tables -> events
});

describe('guest data ops', () => {
  it('getTableByCode returns table with venue, null for unknown', async () => {
    const t = await getTableByCode(code);
    expect(t?.id).toBe(tableId);
    expect(t?.venue.name).toBe('Testcafé');
    expect(t?.venue.googlePlaceId).toBe('ChIJtest');
    expect(await getTableByCode('zzzzzzz')).toBeNull();
  });

  it('recordTap inserts an opened event', async () => {
    const tapId = await recordTap(tableId, venueId);
    const {data} = await admin.from('tap_events').select('outcome').eq('id', tapId).single();
    expect(data!.outcome).toBe('opened');
  });

  it('setTapOutcome upgrades opened only (idempotent)', async () => {
    const tapId = await recordTap(tableId, venueId);
    await setTapOutcome(tapId, 'google_redirect');
    await setTapOutcome(tapId, 'private_feedback'); // must NOT overwrite
    const {data} = await admin.from('tap_events').select('outcome').eq('id', tapId).single();
    expect(data!.outcome).toBe('google_redirect');
  });

  it('submitFeedback stores feedback and marks the tap', async () => {
    const tapId = await recordTap(tableId, venueId);
    await submitFeedback({
      venueId,
      tableId,
      rating: 2,
      categories: ['service', 'wartezeit'],
      comment: 'Zu lange gewartet',
      contact: null,
      tapId
    });
    const {data: fb} = await admin
      .from('feedback')
      .select('rating, categories, comment, contact, read_at')
      .eq('venue_id', venueId)
      .order('created_at', {ascending: false})
      .limit(1)
      .single();
    expect(fb).toMatchObject({
      rating: 2,
      categories: ['service', 'wartezeit'],
      comment: 'Zu lange gewartet',
      contact: null,
      read_at: null
    });
    const {data: tap} = await admin.from('tap_events').select('outcome').eq('id', tapId).single();
    expect(tap!.outcome).toBe('private_feedback');
  });

  it('submitFeedback with tapId null stores feedback and does not touch tap_events', async () => {
    const {count: before} = await admin
      .from('tap_events')
      .select('id', {count: 'exact', head: true})
      .eq('table_id', tableId);
    await submitFeedback({
      venueId,
      tableId,
      rating: 5,
      categories: ['essen'],
      comment: null,
      contact: null,
      tapId: null
    });
    const {data: fb} = await admin
      .from('feedback')
      .select('rating, categories, comment, contact')
      .eq('venue_id', venueId)
      .order('created_at', {ascending: false})
      .limit(1)
      .single();
    expect(fb).toMatchObject({rating: 5, categories: ['essen'], comment: null, contact: null});
    const {count: after} = await admin
      .from('tap_events')
      .select('id', {count: 'exact', head: true})
      .eq('table_id', tableId);
    expect(after).toBe(before);
  });
});
