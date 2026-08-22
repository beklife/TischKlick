# Link-Seite (Hub) & Speisekarte Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each venue a configurable Taplink-style link page as the NFC landing point, with a menu hosted inside TischKlick (categories, items, prices, photos, diet tags, German allergen/additive codes) reachable from it.

**Architecture:** The NFC URL stays `/f/{code}`. A per-venue `hub_enabled` flag decides whether that route renders the new hub or today's star rating — default `false`, so no existing venue changes behaviour. Hub blocks live in one `venue_links` table with a `kind` discriminator (`menu`/`review` are built-in, undeletable, internally-resolving blocks; `custom` rows carry an owner-supplied URL). The menu is two tables (`menu_categories`, `menu_items`). Guest pages stay server-rendered with zero client JS; the only new client component is the dashboard photo field.

**Tech Stack:** Next.js 16.2 App Router (TypeScript), Tailwind CSS v4, next-intl (single `de` locale), @supabase/supabase-js + @supabase/ssr, Vitest (unit + integration against local Supabase), Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-08-22-hub-und-speisekarte-design.md`

## Global Constraints

- **Read the bundled Next.js docs before writing route code.** This repo pins Next 16.2.10 and `AGENTS.md` requires it: `node_modules/next/dist/docs/01-app/`. Relevant pages: `03-api-reference/03-file-conventions/dynamic-routes.md`, `01-getting-started/07-mutating-data.md`, `01-getting-started/12-images.md`.
- All user-facing copy is German and lives in `messages/de.json` (next-intl). No hardcoded UI strings in components. **Exception:** `venue_links.label` and menu item/category names are owner-supplied data from the database, not UI chrome.
- Guest pages (`/f/...`) ship **no client-side JavaScript**: server components, `<a>`/`<Link>`, and `<form action={serverAction}>` only. The dashboard may use small client components.
- Never store IP addresses, user agents, or any fingerprint for guests. After this plan `tap_events` columns are exactly: `id, table_id, venue_id, outcome, created_at, menu_viewed_at`. `menu_viewed_at` is a timestamp, not an identifier.
- No cookies on guest pages; owner side uses only Supabase auth cookies.
- Owner reads/writes go through `createSupabaseServerClient()` so RLS enforces ownership. The service-role client (`createSupabaseAdminClient()`) is only for guest reads/writes and Storage.
- Every server action that touches Storage must verify ownership through the RLS client **first** — the pattern in `src/app/dashboard/einstellungen/actions.ts:uploadLogo`.
- Analytics writes (`setTapOutcome`, `markMenuViewed`) never throw. They `console.error` and continue.
- Rating gating stays in `ratingBranch()` only. This plan does not touch it.
- Local dev DB via `npx supabase start` (Docker required). Integration tests run against it.
- Commit at the end of every task with the message given in the task.

## File Map

| File | Responsibility |
|---|---|
| `supabase/migrations/20260822000000_hub_and_menu.sql` | Schema, RLS, seed trigger, backfill, storage bucket |
| `src/lib/links.ts` | `normalizeLinkUrl()` — owner-supplied URL validation |
| `src/lib/money.ts` | `formatPriceCents()`, `parsePriceInput()` |
| `src/lib/menu.ts` | Diet/allergen/additive vocabularies, code filtering, legend derivation |
| `src/lib/reorder.ts` | `reorderIds()` — pure ▲▼ swap, shared by links/categories/items |
| `src/lib/resize.ts` | `fitWithin()` — pure downscale maths for the photo field |
| `src/lib/hub.ts` | Hub block type, `visibleHubBlocks()`, guest reads for hub + menu |
| `src/lib/guest.ts` | *(modify)* hub fields on the venue read, `markMenuViewed()` |
| `src/lib/venues.ts` | *(modify)* `hubEnabled`/`hubTagline`, `menuViews` in `getVenueStats` |
| `src/app/f/[code]/page.tsx` | *(modify)* entry: record tap, then hub or stars |
| `src/app/f/[code]/star-rating.tsx` | Extracted star UI, used by two routes |
| `src/app/f/[code]/hub.tsx` | Hub UI |
| `src/app/f/[code]/bewerten/page.tsx` | Stars, always |
| `src/app/f/[code]/karte/page.tsx` | Hosted menu for guests |
| `src/app/dashboard/linkseite/page.tsx` + `actions.ts` | Hub configuration |
| `src/app/dashboard/speisekarte/page.tsx` + `actions.ts` | Categories |
| `src/app/dashboard/speisekarte/[categoryId]/page.tsx` + `actions.ts` | Items in one category |
| `src/components/image-upload-field.tsx` | Client: downscale before upload |
| `src/app/dashboard/layout.tsx` | *(modify)* nav grows to six tabs |
| `src/app/dashboard/statistik/page.tsx` | *(modify)* menu-views tile |
| `messages/de.json` | *(modify)* all new copy |

---

### Task 1: Migration — schema, RLS, seed trigger, storage bucket

**Files:**
- Create: `supabase/migrations/20260822000000_hub_and_menu.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: tables `venue_links`, `menu_categories`, `menu_items`; enum `public.link_kind` with values `menu`/`review`/`custom`; columns `venues.hub_enabled boolean not null default false`, `venues.hub_tagline text`, `tap_events.menu_viewed_at timestamptz`; public storage bucket `menu-images`. Every venue (existing and future) owns exactly one `kind='menu'` row labelled `Speisekarte` at `position=0` and one `kind='review'` row labelled `Bewerten` at `position=1`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260822000000_hub_and_menu.sql`:

```sql
-- === Hub configuration on the venue ===
alter table public.venues
  add column hub_enabled boolean not null default false,
  add column hub_tagline text;

-- === Menu-view tracking ===
-- Deliberately a nullable timestamp rather than a new tap_outcome value:
-- tap_outcome is a funnel position that is upgraded exactly once, so a guest
-- who reads the menu and then leaves a 5-star Google review could only ever
-- be counted as one of the two. Orthogonal facts get orthogonal columns.
-- Anonymity rule unchanged: this is a timestamp, never an identifier.
alter table public.tap_events add column menu_viewed_at timestamptz;

-- === Hub blocks ===
create type public.link_kind as enum ('menu', 'review', 'custom');

create table public.venue_links (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  kind public.link_kind not null,
  label text not null,
  icon text,
  url text,
  enabled boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now(),
  -- Only custom blocks carry a URL; menu/review resolve to internal routes.
  constraint venue_links_url_matches_kind
    check ((kind = 'custom') = (url is not null))
);

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  -- Target columns for the composite FK from menu_items below.
  unique (id, venue_id)
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null,
  -- Denormalised so the RLS policy and the guest read stay one hop.
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null,
  description text,
  price_cents int check (price_cents is null or (price_cents >= 0 and price_cents <= 1000000)),
  diet_tags text[] not null default '{}',
  allergens text[] not null default '{}',
  additives text[] not null default '{}',
  image_url text,
  sold_out boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),

  -- One composite FK instead of two independent ones. Without it, owner B
  -- could insert a row with venue_id = their own venue (so the RLS with-check
  -- passes) and category_id = a category owned by A, smuggling an item into
  -- A's menu, which is read by category.
  constraint menu_items_category_same_venue
    foreign key (category_id, venue_id)
    references public.menu_categories (id, venue_id) on delete cascade
);

create index venue_links_venue_pos_idx on public.venue_links (venue_id, position);
-- A venue has at most one menu block and one review block.
create unique index venue_links_one_builtin_idx
  on public.venue_links (venue_id, kind) where kind <> 'custom';
create index menu_categories_venue_pos_idx on public.menu_categories (venue_id, position);
create index menu_items_category_pos_idx on public.menu_items (category_id, position);

-- === RLS ===
-- Grants are inherited: the init migration set `alter default privileges in
-- schema public grant select, insert, update, delete on tables to authenticated`
-- and revoked everything from anon, so these three tables are already covered.
alter table public.venue_links enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;

create policy "venue_links: own venue" on public.venue_links
  for all to authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = (select auth.uid())));

create policy "menu_categories: own venue" on public.menu_categories
  for all to authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = (select auth.uid())));

create policy "menu_items: own venue" on public.menu_items
  for all to authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = (select auth.uid())));

-- Guests read through the service-role client only. No anon policies on purpose.

-- === Seed the two built-in blocks for every venue ===
-- A trigger rather than application code, so every path that creates a venue
-- (onboarding, tests, manual inserts) produces a consistent venue.
create function public.seed_venue_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.venue_links (venue_id, kind, label, icon, position)
  values (new.id, 'menu', 'Speisekarte', '🍽️', 0),
         (new.id, 'review', 'Bewerten', '⭐', 1);
  return new;
end;
$$;

create trigger on_venue_created
after insert on public.venues
for each row execute procedure public.seed_venue_links();

-- Backfill venues that already existed. Invisible until hub_enabled is set.
insert into public.venue_links (venue_id, kind, label, icon, position)
select v.id, k.kind, k.label, k.icon, k.pos
from public.venues v
cross join (values
  ('menu'::public.link_kind, 'Speisekarte', '🍽️', 0),
  ('review'::public.link_kind, 'Bewerten', '⭐', 1)
) as k(kind, label, icon, pos)
on conflict do nothing;

-- === Storage: public menu images bucket ===
insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;
```

- [ ] **Step 2: Apply the migration and verify it is accepted**

Run: `npx supabase db reset`
Expected: completes without error, and the output lists `20260822000000_hub_and_menu.sql` as applied.

- [ ] **Step 3: Verify the seed trigger and the composite FK guard by hand**

Run:

```bash
npx supabase db reset >/dev/null 2>&1
psql "$(npx supabase status -o env | grep '^DB_URL=' | cut -d= -f2- | tr -d '"')" <<'SQL'
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'seed@test.local', '', now(), now(), now());
insert into public.venues (owner_id, name, slug)
select id, 'Trigger Café', 'trigger-cafe' from public.owners limit 1;
-- expect exactly 2 rows: Speisekarte / Bewerten
select kind, label, position from public.venue_links order by position;
SQL
```

Expected: two rows — `menu | Speisekarte | 0` and `review | Bewerten | 1`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260822000000_hub_and_menu.sql
git commit -m "feat(db): hub blocks, hosted menu tables, menu-view tracking"
```

---

### Task 2: `normalizeLinkUrl` — owner-supplied URL validation

**Files:**
- Create: `src/lib/links.ts`
- Test: `tests/unit/links.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `normalizeLinkUrl(raw: unknown): string | null` — returns a normalised absolute `https:` URL, or a compacted `tel:`/`mailto:` URI, or `null` when the input is unusable. `MAX_LINK_URL_LENGTH: number` (500).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/links.test.ts`:

```ts
import {describe, it, expect} from 'vitest';
import {normalizeLinkUrl} from '@/lib/links';

describe('normalizeLinkUrl', () => {
  it('passes an https URL through', () => {
    expect(normalizeLinkUrl('https://instagram.com/cafesonne')).toBe(
      'https://instagram.com/cafesonne'
    );
  });

  it('prepends https to a scheme-less host', () => {
    expect(normalizeLinkUrl('wa.me/4930123')).toBe('https://wa.me/4930123');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeLinkUrl('  cafe-sonne.de  ')).toBe('https://cafe-sonne.de/');
  });

  it('accepts a mailto address', () => {
    expect(normalizeLinkUrl('mailto:info@cafe-sonne.de')).toBe('mailto:info@cafe-sonne.de');
  });

  it('accepts a tel number and strips its formatting', () => {
    expect(normalizeLinkUrl('tel:+49 30 1234567')).toBe('tel:+49301234567');
  });

  it('rejects javascript:', () => {
    expect(normalizeLinkUrl('javascript:alert(1)')).toBeNull();
  });

  it('rejects javascript: hidden by leading whitespace and mixed case', () => {
    expect(normalizeLinkUrl('  JaVaScRiPt:alert(1)')).toBeNull();
  });

  it('rejects data: URLs', () => {
    expect(normalizeLinkUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
  });

  it('rejects a protocol-relative URL', () => {
    expect(normalizeLinkUrl('//evil.example')).toBeNull();
  });

  it('rejects plain http', () => {
    expect(normalizeLinkUrl('http://cafe-sonne.de')).toBeNull();
  });

  it('rejects a host without a dot', () => {
    expect(normalizeLinkUrl('localhost')).toBeNull();
  });

  it('rejects an over-long URL', () => {
    expect(normalizeLinkUrl(`https://x.de/${'a'.repeat(600)}`)).toBeNull();
  });

  it('rejects empty and non-string input', () => {
    expect(normalizeLinkUrl('')).toBeNull();
    expect(normalizeLinkUrl('   ')).toBeNull();
    expect(normalizeLinkUrl(undefined)).toBeNull();
    expect(normalizeLinkUrl(42)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- links`
Expected: FAIL — cannot resolve `@/lib/links`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/links.ts`:

```ts
// Owner-supplied hub link URLs. The owner is trusted-ish, but their guests are
// not: a pasted javascript:/data: URL would execute in every guest's browser,
// so validation happens once, on save, and the stored value is the safe one.
export const MAX_LINK_URL_LENGTH = 500;

// Lives here rather than in the server-action file: a module with the
// 'use server' directive may only export async functions, so a plain constant
// exported from actions.ts would fail the build.
export const MAX_CUSTOM_LINKS = 12;

const MAILTO_RE = /^mailto:[^\s@]+@[^\s@.]+\.[^\s@]+$/i;
const TEL_RE = /^tel:\+?[0-9][0-9\s()/-]{2,30}$/i;
const HAS_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

export function normalizeLinkUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_LINK_URL_LENGTH) return null;

  // Protocol-relative: it would silently inherit our scheme. Ambiguous enough
  // that rejecting it and letting the owner retype is the honest answer.
  if (trimmed.startsWith('//')) return null;

  if (/^mailto:/i.test(trimmed)) return MAILTO_RE.test(trimmed) ? trimmed : null;
  if (/^tel:/i.test(trimmed)) {
    return TEL_RE.test(trimmed) ? trimmed.replace(/[\s()/-]/g, '') : null;
  }

  const candidate = HAS_SCHEME_RE.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  // Rejects http:, javascript:, data:, vbscript:, file: in one check.
  if (url.protocol !== 'https:') return null;
  if (!url.hostname.includes('.')) return null;

  const href = url.toString();
  return href.length <= MAX_LINK_URL_LENGTH ? href : null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit -- links`
Expected: PASS, 14 assertions across 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/links.ts tests/unit/links.test.ts
git commit -m "feat(lib): validate owner-supplied hub link URLs"
```

---

### Task 3: Menu domain — prices, diet tags, allergens, additives

**Files:**
- Create: `src/lib/money.ts`, `src/lib/menu.ts`
- Test: `tests/unit/money.test.ts`, `tests/unit/menu.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `formatPriceCents(cents: number | null | undefined): string | null`
  - `parsePriceInput(raw: unknown): number | null` — throws `RangeError` on malformed or out-of-range input, returns `null` for empty (meaning "Tagespreis")
  - `MAX_PRICE_CENTS: number` (1000000)
  - `DIET_TAGS: readonly DietTag[]`, `type DietTag`
  - `ALLERGENS: Record<AllergenCode, string>`, `type AllergenCode`
  - `ADDITIVES: Record<AdditiveCode, string>`, `type AdditiveCode`
  - `filterDietTags(values: unknown): DietTag[]`
  - `filterAllergens(values: unknown): AllergenCode[]`
  - `filterAdditives(values: unknown): AdditiveCode[]`
  - `buildLegend(items: Array<{allergens: string[]; additives: string[]}>): {allergens: Array<[AllergenCode, string]>; additives: Array<[AdditiveCode, string]>}`

- [ ] **Step 1: Write the failing price test**

Create `tests/unit/money.test.ts`:

```ts
import {describe, it, expect} from 'vitest';
import {formatPriceCents, parsePriceInput, MAX_PRICE_CENTS} from '@/lib/money';

describe('formatPriceCents', () => {
  // Intl inserts a narrow/non-breaking space before the currency symbol,
  // and which one depends on the ICU build — match loosely on purpose.
  it('formats cents as German euros', () => {
    expect(formatPriceCents(1400)).toMatch(/^14,00\s€$/);
  });

  it('formats a sub-euro price', () => {
    expect(formatPriceCents(50)).toMatch(/^0,50\s€$/);
  });

  it('returns null for a missing price', () => {
    expect(formatPriceCents(null)).toBeNull();
    expect(formatPriceCents(undefined)).toBeNull();
  });
});

describe('parsePriceInput', () => {
  it('parses a German decimal comma', () => {
    expect(parsePriceInput('14,00')).toBe(1400);
  });

  it('parses a decimal point', () => {
    expect(parsePriceInput('14.50')).toBe(1450);
  });

  it('parses a whole number', () => {
    expect(parsePriceInput('14')).toBe(1400);
  });

  it('ignores a euro sign and surrounding whitespace', () => {
    expect(parsePriceInput(' 6,50 € ')).toBe(650);
  });

  it('treats empty input as no price', () => {
    expect(parsePriceInput('')).toBeNull();
    expect(parsePriceInput('   ')).toBeNull();
    expect(parsePriceInput(undefined)).toBeNull();
  });

  it('rejects a negative price', () => {
    expect(() => parsePriceInput('-5')).toThrow(RangeError);
  });

  it('rejects three decimal places', () => {
    expect(() => parsePriceInput('14,005')).toThrow(RangeError);
  });

  it('rejects nonsense', () => {
    expect(() => parsePriceInput('vierzehn')).toThrow(RangeError);
  });

  it('rejects a price above the cap', () => {
    expect(() => parsePriceInput('99999999')).toThrow(RangeError);
  });

  it('accepts exactly the cap', () => {
    expect(parsePriceInput('10000')).toBe(MAX_PRICE_CENTS);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:unit -- money`
Expected: FAIL — cannot resolve `@/lib/money`.

- [ ] **Step 3: Implement `src/lib/money.ts`**

```ts
export const MAX_PRICE_CENTS = 1_000_000;

const priceFormatter = new Intl.NumberFormat('de-DE', {style: 'currency', currency: 'EUR'});

export function formatPriceCents(cents: number | null | undefined): string | null {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return null;
  return priceFormatter.format(cents / 100);
}

// Empty means "no fixed price" (Tagespreis) and is a valid state, so it returns
// null. Malformed input is a mistake the owner must see, so it throws — the
// server action catches and redirects with ?fehler=1.
export function parsePriceInput(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const compact = raw.trim().replace(/[\s€]/g, '');
  if (!compact) return null;
  if (!/^\d{1,7}([.,]\d{1,2})?$/.test(compact)) {
    throw new RangeError(`Ungültiger Preis: ${raw}`);
  }
  const cents = Math.round(Number(compact.replace(',', '.')) * 100);
  if (cents > MAX_PRICE_CENTS) {
    throw new RangeError(`Preis außerhalb des zulässigen Bereichs: ${raw}`);
  }
  return cents;
}
```

- [ ] **Step 4: Run the price test to verify it passes**

Run: `npm run test:unit -- money`
Expected: PASS.

- [ ] **Step 5: Write the failing menu-vocabulary test**

Create `tests/unit/menu.test.ts`:

```ts
import {describe, it, expect} from 'vitest';
import {
  DIET_TAGS,
  ALLERGENS,
  ADDITIVES,
  filterDietTags,
  filterAllergens,
  filterAdditives,
  buildLegend
} from '@/lib/menu';

describe('vocabularies', () => {
  it('covers the 14 EU allergens as letters a-n', () => {
    expect(Object.keys(ALLERGENS)).toHaveLength(14);
    expect(Object.keys(ALLERGENS)[0]).toBe('a');
    expect(Object.keys(ALLERGENS)[13]).toBe('n');
  });

  it('covers the German additive numbers 1-12', () => {
    expect(Object.keys(ADDITIVES)).toHaveLength(12);
  });

  it('offers four diet tags', () => {
    expect(DIET_TAGS).toEqual(['vegetarisch', 'vegan', 'scharf', 'glutenfrei']);
  });
});

describe('filters', () => {
  it('keeps known diet tags and drops the rest', () => {
    expect(filterDietTags(['vegan', 'erfunden', 'scharf'])).toEqual(['vegan', 'scharf']);
  });

  it('deduplicates', () => {
    expect(filterAllergens(['a', 'a', 'g'])).toEqual(['a', 'g']);
  });

  it('drops unknown allergen codes', () => {
    expect(filterAllergens(['a', 'z', '3'])).toEqual(['a']);
  });

  it('keeps additive codes as strings', () => {
    expect(filterAdditives(['1', '11', '99'])).toEqual(['1', '11']);
  });

  it('returns an empty array for non-array input', () => {
    expect(filterDietTags('vegan')).toEqual([]);
    expect(filterAllergens(undefined)).toEqual([]);
  });
});

describe('buildLegend', () => {
  it('lists only codes actually used, allergens alphabetical and additives numeric', () => {
    const legend = buildLegend([
      {allergens: ['g', 'a'], additives: ['11']},
      {allergens: ['a'], additives: ['2']},
      {allergens: [], additives: []}
    ]);
    expect(legend.allergens.map(([code]) => code)).toEqual(['a', 'g']);
    expect(legend.additives.map(([code]) => code)).toEqual(['2', '11']);
    expect(legend.allergens[0][1]).toBe(ALLERGENS.a);
  });

  it('returns empty groups when nothing is tagged', () => {
    expect(buildLegend([{allergens: [], additives: []}])).toEqual({allergens: [], additives: []});
  });

  it('ignores codes that are not in the vocabulary', () => {
    const legend = buildLegend([{allergens: ['zz'], additives: ['77']}]);
    expect(legend).toEqual({allergens: [], additives: []});
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm run test:unit -- menu`
Expected: FAIL — cannot resolve `@/lib/menu`.

- [ ] **Step 7: Implement `src/lib/menu.ts`**

```ts
export const DIET_TAGS = ['vegetarisch', 'vegan', 'scharf', 'glutenfrei'] as const;
export type DietTag = (typeof DIET_TAGS)[number];

// The 14 allergens of EU regulation 1169/2011, lettered as German menus letter them.
export const ALLERGENS = {
  a: 'Glutenhaltiges Getreide',
  b: 'Krebstiere',
  c: 'Eier',
  d: 'Fische',
  e: 'Erdnüsse',
  f: 'Sojabohnen',
  g: 'Milch/Laktose',
  h: 'Schalenfrüchte',
  i: 'Sellerie',
  j: 'Senf',
  k: 'Sesamsamen',
  l: 'Schwefeldioxid/Sulfite',
  m: 'Lupinen',
  n: 'Weichtiere'
} as const;
export type AllergenCode = keyof typeof ALLERGENS;

// Zusatzstoff-Kennzeichnung per German ZZulV.
export const ADDITIVES = {
  '1': 'mit Farbstoff',
  '2': 'mit Konservierungsstoff',
  '3': 'mit Antioxidationsmittel',
  '4': 'mit Geschmacksverstärker',
  '5': 'geschwefelt',
  '6': 'geschwärzt',
  '7': 'gewachst',
  '8': 'mit Phosphat',
  '9': 'mit Süßungsmittel',
  '10': 'enthält eine Phenylalaninquelle',
  '11': 'koffeinhaltig',
  '12': 'chininhaltig'
} as const;
export type AdditiveCode = keyof typeof ADDITIVES;

function filterCodes<T extends string>(values: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<T>();
  for (const value of values) {
    if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
      seen.add(value as T);
    }
  }
  return [...seen];
}

export function filterDietTags(values: unknown): DietTag[] {
  return filterCodes(values, DIET_TAGS);
}

export function filterAllergens(values: unknown): AllergenCode[] {
  return filterCodes(values, Object.keys(ALLERGENS) as AllergenCode[]);
}

export function filterAdditives(values: unknown): AdditiveCode[] {
  return filterCodes(values, Object.keys(ADDITIVES) as AdditiveCode[]);
}

// The guest legend shows only the codes the venue actually uses — a full
// 26-entry legend under a six-item menu is noise.
export function buildLegend(items: Array<{allergens: string[]; additives: string[]}>): {
  allergens: Array<[AllergenCode, string]>;
  additives: Array<[AdditiveCode, string]>;
} {
  const allergenCodes = filterAllergens(items.flatMap((i) => i.allergens));
  const additiveCodes = filterAdditives(items.flatMap((i) => i.additives));
  return {
    allergens: allergenCodes
      .sort((a, b) => a.localeCompare(b))
      .map((code) => [code, ALLERGENS[code]]),
    additives: additiveCodes
      .sort((a, b) => Number(a) - Number(b))
      .map((code) => [code, ADDITIVES[code]])
  };
}
```

- [ ] **Step 8: Run both tests to verify they pass**

Run: `npm run test:unit -- money menu`
Expected: PASS, both files green.

- [ ] **Step 9: Commit**

```bash
git add src/lib/money.ts src/lib/menu.ts tests/unit/money.test.ts tests/unit/menu.test.ts
git commit -m "feat(lib): price formatting and German menu labelling vocabularies"
```

---

### Task 4: Pure helpers for reordering and image downscaling

**Files:**
- Create: `src/lib/reorder.ts`, `src/lib/resize.ts`
- Test: `tests/unit/reorder.test.ts`, `tests/unit/resize.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `reorderIds(ids: string[], id: string, direction: 'up' | 'down'): string[] | null` — the full list with `id` swapped one place; `null` when the move is impossible (unknown id, already at an end).
  - `fitWithin(width: number, height: number, maxEdge: number): {width: number; height: number}`
  - `MAX_IMAGE_EDGE: number` (1200)

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/reorder.test.ts`:

```ts
import {describe, it, expect} from 'vitest';
import {reorderIds} from '@/lib/reorder';

describe('reorderIds', () => {
  it('moves an item up', () => {
    expect(reorderIds(['a', 'b', 'c'], 'b', 'up')).toEqual(['b', 'a', 'c']);
  });

  it('moves an item down', () => {
    expect(reorderIds(['a', 'b', 'c'], 'b', 'down')).toEqual(['a', 'c', 'b']);
  });

  it('refuses to move the first item up', () => {
    expect(reorderIds(['a', 'b'], 'a', 'up')).toBeNull();
  });

  it('refuses to move the last item down', () => {
    expect(reorderIds(['a', 'b'], 'b', 'down')).toBeNull();
  });

  it('returns null for an unknown id', () => {
    expect(reorderIds(['a', 'b'], 'z', 'up')).toBeNull();
  });

  it('does not mutate the input', () => {
    const input = ['a', 'b'];
    reorderIds(input, 'b', 'up');
    expect(input).toEqual(['a', 'b']);
  });
});
```

Create `tests/unit/resize.test.ts`:

```ts
import {describe, it, expect} from 'vitest';
import {fitWithin, MAX_IMAGE_EDGE} from '@/lib/resize';

describe('fitWithin', () => {
  it('leaves a small image alone', () => {
    expect(fitWithin(800, 600, MAX_IMAGE_EDGE)).toEqual({width: 800, height: 600});
  });

  it('scales a wide image by its width', () => {
    expect(fitWithin(4000, 2000, 1200)).toEqual({width: 1200, height: 600});
  });

  it('scales a tall image by its height', () => {
    expect(fitWithin(2000, 4000, 1200)).toEqual({width: 600, height: 1200});
  });

  it('rounds to whole pixels and never returns zero', () => {
    expect(fitWithin(3000, 7, 1200)).toEqual({width: 1200, height: 1});
  });

  it('handles a square image', () => {
    expect(fitWithin(2400, 2400, 1200)).toEqual({width: 1200, height: 1200});
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run test:unit -- reorder resize`
Expected: FAIL — cannot resolve `@/lib/reorder` and `@/lib/resize`.

- [ ] **Step 3: Implement both modules**

Create `src/lib/reorder.ts`:

```ts
// Shared by the hub block list, menu categories and menu items. Callers
// renumber `position` to the returned index, which also repairs any duplicate
// or gapped positions left behind by earlier edits.
export function reorderIds(ids: string[], id: string, direction: 'up' | 'down'): string[] | null {
  const from = ids.indexOf(id);
  if (from === -1) return null;
  const to = direction === 'up' ? from - 1 : from + 1;
  if (to < 0 || to >= ids.length) return null;
  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
```

Create `src/lib/resize.ts`:

```ts
// A menu with 30 unscaled phone photos is tens of megabytes and never loads on
// café wifi, so the browser downscales before upload. Kept pure and separate
// from the canvas code so the maths is testable in Node.
export const MAX_IMAGE_EDGE = 1200;

export function fitWithin(
  width: number,
  height: number,
  maxEdge: number
): {width: number; height: number} {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return {width, height};
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:unit -- reorder resize`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reorder.ts src/lib/resize.ts tests/unit/reorder.test.ts tests/unit/resize.test.ts
git commit -m "feat(lib): pure reorder and image-fit helpers"
```

---

### Task 5: `src/lib/hub.ts` — block visibility rules and guest reads

**Files:**
- Create: `src/lib/hub.ts`
- Test: `tests/unit/hub.test.ts`

**Interfaces:**
- Consumes: `createSupabaseAdminClient` from `@/lib/supabase/admin`.
- Produces:
  - `type HubBlockKind = 'menu' | 'review' | 'custom'`
  - `type HubBlock = {id: string; kind: HubBlockKind; label: string; icon: string | null; url: string | null; enabled: boolean; position: number}`
  - `type MenuItem = {id: string; name: string; description: string | null; priceCents: number | null; dietTags: string[]; allergens: string[]; additives: string[]; imageUrl: string | null; soldOut: boolean}`
  - `type MenuCategory = {id: string; name: string; items: MenuItem[]}`
  - `visibleHubBlocks(blocks: HubBlock[], opts: {hasMenuItems: boolean}): HubBlock[]`
  - `getVenueHubBlocks(venueId: string): Promise<HubBlock[]>`
  - `venueHasMenuItems(venueId: string): Promise<boolean>`
  - `getVenueMenu(venueId: string): Promise<MenuCategory[]>`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/hub.test.ts`:

```ts
import {describe, it, expect} from 'vitest';
import {visibleHubBlocks, type HubBlock} from '@/lib/hub';

function block(over: Partial<HubBlock> & Pick<HubBlock, 'id' | 'kind'>): HubBlock {
  return {
    label: over.kind,
    icon: null,
    url: over.kind === 'custom' ? 'https://example.de/' : null,
    enabled: true,
    position: 0,
    ...over
  };
}

describe('visibleHubBlocks', () => {
  it('sorts by position', () => {
    const blocks = [
      block({id: 'c', kind: 'custom', position: 2}),
      block({id: 'a', kind: 'review', position: 0}),
      block({id: 'b', kind: 'menu', position: 1})
    ];
    expect(visibleHubBlocks(blocks, {hasMenuItems: true}).map((b) => b.id)).toEqual([
      'a',
      'b',
      'c'
    ]);
  });

  it('breaks position ties by id so the order is stable', () => {
    const blocks = [
      block({id: 'zz', kind: 'custom', position: 0}),
      block({id: 'aa', kind: 'custom', position: 0})
    ];
    expect(visibleHubBlocks(blocks, {hasMenuItems: true}).map((b) => b.id)).toEqual(['aa', 'zz']);
  });

  it('drops disabled blocks', () => {
    const blocks = [
      block({id: 'a', kind: 'review', position: 0}),
      block({id: 'b', kind: 'custom', position: 1, enabled: false})
    ];
    expect(visibleHubBlocks(blocks, {hasMenuItems: true}).map((b) => b.id)).toEqual(['a']);
  });

  it('hides the menu block when the venue has no items, even if enabled', () => {
    const blocks = [
      block({id: 'm', kind: 'menu', position: 0}),
      block({id: 'r', kind: 'review', position: 1})
    ];
    expect(visibleHubBlocks(blocks, {hasMenuItems: false}).map((b) => b.id)).toEqual(['r']);
  });

  it('shows the menu block once the venue has items', () => {
    const blocks = [block({id: 'm', kind: 'menu', position: 0})];
    expect(visibleHubBlocks(blocks, {hasMenuItems: true}).map((b) => b.id)).toEqual(['m']);
  });

  it('returns nothing when every block is hidden — caller falls back to the stars', () => {
    const blocks = [
      block({id: 'm', kind: 'menu', position: 0}),
      block({id: 'r', kind: 'review', position: 1, enabled: false})
    ];
    expect(visibleHubBlocks(blocks, {hasMenuItems: false})).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const blocks = [
      block({id: 'b', kind: 'custom', position: 1}),
      block({id: 'a', kind: 'custom', position: 0})
    ];
    visibleHubBlocks(blocks, {hasMenuItems: true});
    expect(blocks.map((b) => b.id)).toEqual(['b', 'a']);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:unit -- hub`
Expected: FAIL — cannot resolve `@/lib/hub`.

- [ ] **Step 3: Implement `src/lib/hub.ts`**

```ts
import {createSupabaseAdminClient} from '@/lib/supabase/admin';

export type HubBlockKind = 'menu' | 'review' | 'custom';

export type HubBlock = {
  id: string;
  kind: HubBlockKind;
  label: string;
  icon: string | null;
  url: string | null;
  enabled: boolean;
  position: number;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number | null;
  dietTags: string[];
  allergens: string[];
  additives: string[];
  imageUrl: string | null;
  soldOut: boolean;
};

export type MenuCategory = {id: string; name: string; items: MenuItem[]};

// Pure so the two rules that keep a guest from ever reaching a dead end are
// testable without a database:
//   1. a menu block with nothing behind it is not shown,
//   2. an empty result tells the caller to fall back to the star rating.
export function visibleHubBlocks(blocks: HubBlock[], opts: {hasMenuItems: boolean}): HubBlock[] {
  return blocks
    .filter((b) => b.enabled)
    .filter((b) => b.kind !== 'menu' || opts.hasMenuItems)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

type LinkRow = {
  id: string;
  kind: HubBlockKind;
  label: string;
  icon: string | null;
  url: string | null;
  enabled: boolean;
  position: number;
};

export async function getVenueHubBlocks(venueId: string): Promise<HubBlock[]> {
  const supabase = createSupabaseAdminClient();
  const {data, error} = await supabase
    .from('venue_links')
    .select('id, kind, label, icon, url, enabled, position')
    .eq('venue_id', venueId);
  if (error) throw error;
  return (data ?? []) as LinkRow[];
}

export async function venueHasMenuItems(venueId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const {count, error} = await supabase
    .from('menu_items')
    .select('id', {count: 'exact', head: true})
    .eq('venue_id', venueId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

type MenuRow = {
  id: string;
  name: string;
  position: number;
  menu_items: Array<{
    id: string;
    name: string;
    description: string | null;
    price_cents: number | null;
    diet_tags: string[];
    allergens: string[];
    additives: string[];
    image_url: string | null;
    sold_out: boolean;
    position: number;
  }>;
};

export async function getVenueMenu(venueId: string): Promise<MenuCategory[]> {
  const supabase = createSupabaseAdminClient();
  const {data, error} = await supabase
    .from('menu_categories')
    .select(
      'id, name, position, menu_items (id, name, description, price_cents, diet_tags, allergens, additives, image_url, sold_out, position)'
    )
    .eq('venue_id', venueId)
    .order('position');
  if (error) throw error;

  // PostgREST resolves the embed through the single foreign key between the two
  // tables (menu_items_category_same_venue). If it ever reports an ambiguous or
  // missing relationship, name it explicitly: `menu_items!menu_items_category_same_venue (...)`.
  //
  // Sorting items in JS rather than via a nested order(): the embedded rows
  // come back unordered often enough that relying on it would be a lottery.
  return ((data ?? []) as unknown as MenuRow[]).map((c) => ({
    id: c.id,
    name: c.name,
    items: [...c.menu_items]
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
      .map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description,
        priceCents: i.price_cents,
        dietTags: i.diet_tags,
        allergens: i.allergens,
        additives: i.additives,
        imageUrl: i.image_url,
        soldOut: i.sold_out
      }))
  }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit -- hub`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hub.ts tests/unit/hub.test.ts
git commit -m "feat(lib): hub block visibility rules and guest menu reads"
```

---

### Task 6: Integration tests — RLS isolation, seed trigger, cross-venue guard

**Files:**
- Create: `tests/integration/menu-rls.test.ts`

**Interfaces:**
- Consumes: the schema from Task 1.
- Produces: nothing consumed by later tasks. This is the proof that the security boundary from the spec holds.

- [ ] **Step 1: Write the test**

Create `tests/integration/menu-rls.test.ts`:

```ts
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
  });

  it('anon has no privileges on the new tables', async () => {
    const anon = createClient(URL, ANON, {auth: {persistSession: false}});
    const links = await anon.from('venue_links').select('id');
    const items = await anon.from('menu_items').select('id');
    expect(links.error).not.toBeNull();
    expect(items.error).not.toBeNull();
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
```

- [ ] **Step 2: Run the test**

Run: `npx supabase start && npm run test:integration -- menu-rls`
Expected: PASS, 9 tests. If the seed-trigger test fails with zero rows, the migration's trigger was not applied — re-run `npx supabase db reset`.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/menu-rls.test.ts
git commit -m "test: RLS isolation and cross-venue guards for hub and menu tables"
```

---

### Task 7: Guest data layer — hub fields and menu-view tracking

**Files:**
- Modify: `src/lib/guest.ts`
- Test: `tests/integration/menu-view.test.ts`

**Interfaces:**
- Consumes: `menu_viewed_at` and the venue hub columns from Task 1.
- Produces:
  - `GuestTable['venue']` gains `hubEnabled: boolean` and `hubTagline: string | null`.
  - `markMenuViewed(tapId: string, tableId: string): Promise<void>` — idempotent, scoped to the tap's own table, never throws.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/menu-view.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:integration -- menu-view`
Expected: FAIL — `markMenuViewed` is not exported from `@/lib/guest`.

- [ ] **Step 3: Extend `src/lib/guest.ts`**

In the `GuestTable` type, add two fields to `venue`:

```ts
  venue: {
    id: string;
    name: string;
    logoUrl: string | null;
    googlePlaceId: string | null;
    googleReviewUrl: string | null;
    hubEnabled: boolean;
    hubTagline: string | null;
  };
```

In `getTableByCode`, widen the select and the row type, and map the new fields:

```ts
  const {data, error} = await supabase
    .from('tables')
    .select(
      'id, code, label, venues (id, name, logo_url, google_place_id, google_review_url, hub_enabled, hub_tagline)'
    )
    .eq('code', code)
    .maybeSingle();
```

```ts
  const v = data.venues as unknown as {
    id: string; name: string; logo_url: string | null;
    google_place_id: string | null; google_review_url: string | null;
    hub_enabled: boolean; hub_tagline: string | null;
  };
  return {
    id: data.id,
    code: data.code,
    label: data.label,
    venue: {
      id: v.id,
      name: v.name,
      logoUrl: v.logo_url,
      googlePlaceId: v.google_place_id,
      googleReviewUrl: v.google_review_url,
      hubEnabled: v.hub_enabled,
      hubTagline: v.hub_tagline
    }
  };
```

Append the new function at the end of the file:

```ts
export async function markMenuViewed(tapId: string, tableId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  // Scoped to the tap's own table so a guessed/forged ?t= cannot stamp a
  // stranger's row, and idempotent so a reload does not move the timestamp.
  const {error} = await supabase
    .from('tap_events')
    .update({menu_viewed_at: new Date().toISOString()})
    .eq('id', tapId)
    .eq('table_id', tableId)
    .is('menu_viewed_at', null);
  // Analytics, not the guest flow: never throw. Same rule as setTapOutcome.
  if (error) console.error('markMenuViewed failed:', error);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:integration -- menu-view`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/guest.ts tests/integration/menu-view.test.ts
git commit -m "feat(guest): expose hub config and record menu views"
```

---

### Task 8: Guest routes — hub at `/f/[code]`, stars at `/f/[code]/bewerten`

**Files:**
- Create: `src/app/f/[code]/star-rating.tsx`, `src/app/f/[code]/hub.tsx`, `src/app/f/[code]/bewerten/page.tsx`
- Modify: `src/app/f/[code]/page.tsx`, `messages/de.json`

**Interfaces:**
- Consumes: `visibleHubBlocks`, `getVenueHubBlocks`, `venueHasMenuItems` (Task 5); `getTableByCode`, `recordTap`, `cleanTapId` (Task 7).
- Produces:
  - `<StarRating code={string} tapId={string} venue={{name: string; logoUrl: string | null}} />` — the star UI, server component.
  - `<Hub code={string} tapId={string} venue={{name: string; logoUrl: string | null; hubTagline: string | null}} blocks={HubBlock[]} />`
  - Route `/f/[code]/bewerten` accepting `?t=<uuid>`.

- [ ] **Step 1: Add the German copy**

In `messages/de.json`, add these keys inside the existing `"guest"` object:

```json
    "menuTitle": "Speisekarte",
    "menuEmpty": "Die Speisekarte ist noch nicht hinterlegt.",
    "soldOut": "ausverkauft",
    "legendTitle": "Kennzeichnung",
    "diet": {
      "vegetarisch": "vegetarisch",
      "vegan": "vegan",
      "scharf": "scharf",
      "glutenfrei": "glutenfrei"
    }
```

- [ ] **Step 2: Extract the star UI into `src/app/f/[code]/star-rating.tsx`**

This is the markup currently inline in `src/app/f/[code]/page.tsx`, unchanged except that the star links now always carry the tap id:

```tsx
import {getTranslations} from 'next-intl/server';
import Image from 'next/image';

type Props = {
  code: string;
  tapId: string;
  venue: {name: string; logoUrl: string | null};
};

export async function StarRating({code, tapId, venue}: Props) {
  const t = await getTranslations('guest');
  return (
    <div className="text-center">
      {venue.logoUrl ? (
        <Image
          src={venue.logoUrl}
          alt={venue.name}
          width={96}
          height={96}
          className="mx-auto mb-4 h-24 w-24 rounded-full object-cover"
          unoptimized
        />
      ) : null}
      <p className="text-lg font-medium text-terra">{venue.name}</p>
      <h1 className="mt-4 text-2xl font-semibold">{t('question')}</h1>
      <div className="mt-8 flex flex-row-reverse justify-center gap-2">
        {[5, 4, 3, 2, 1].map((r) => (
          <a
            key={r}
            href={`/f/${code}/${r}?t=${tapId}`}
            aria-label={t('starLabel', {count: r})}
            className="peer flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-3xl text-muted/40 shadow-sm ring-1 ring-line transition-colors hover:text-terra peer-hover:text-terra active:scale-95 active:text-terra"
          >
            ★
          </a>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted">{t('ratingHint')}</p>
    </div>
  );
}
```

- [ ] **Step 3: Write the hub component `src/app/f/[code]/hub.tsx`**

```tsx
import Image from 'next/image';
import Link from 'next/link';
import type {HubBlock} from '@/lib/hub';

type Props = {
  code: string;
  tapId: string;
  venue: {name: string; logoUrl: string | null; hubTagline: string | null};
  blocks: HubBlock[];
};

// The review block is the point of the product, so it gets the filled treatment
// and everything else stays quiet.
const PRIMARY = 'bg-terra text-white shadow active:bg-terra-dark';
const SECONDARY = 'bg-card text-ink ring-1 ring-line active:bg-cream';

function blockHref(block: HubBlock, code: string, tapId: string): string {
  if (block.kind === 'menu') return `/f/${code}/karte?t=${tapId}`;
  if (block.kind === 'review') return `/f/${code}/bewerten?t=${tapId}`;
  return block.url!;
}

export function Hub({code, tapId, venue, blocks}: Props) {
  return (
    <div>
      <div className="text-center">
        {venue.logoUrl ? (
          <Image
            src={venue.logoUrl}
            alt={venue.name}
            width={96}
            height={96}
            className="mx-auto mb-4 h-24 w-24 rounded-full object-cover"
            unoptimized
          />
        ) : null}
        <h1 className="text-2xl font-semibold">{venue.name}</h1>
        {venue.hubTagline ? (
          <p className="mt-1 text-sm text-muted">{venue.hubTagline}</p>
        ) : null}
      </div>

      <ul className="mt-8 space-y-3">
        {blocks.map((block) => {
          const href = blockHref(block, code, tapId);
          const className = `flex items-center gap-4 rounded-2xl px-5 py-4 text-base font-medium ${
            block.kind === 'review' ? PRIMARY : SECONDARY
          }`;
          const inner = (
            <>
              {block.icon ? (
                <span aria-hidden className="text-2xl leading-none">
                  {block.icon}
                </span>
              ) : null}
              <span className="flex-1">{block.label}</span>
              <span aria-hidden className="opacity-40">
                ›
              </span>
            </>
          );
          return (
            <li key={block.id}>
              {block.kind === 'custom' ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
                  {inner}
                </a>
              ) : (
                <Link href={href} className={className}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Rewrite `src/app/f/[code]/page.tsx` as the entry point**

```tsx
import {getTableByCode, recordTap, cleanTapId} from '@/lib/guest';
import {getVenueHubBlocks, venueHasMenuItems, visibleHubBlocks} from '@/lib/hub';
import {InvalidLink} from '../invalid-link';
import {StarRating} from './star-rating';
import {Hub} from './hub';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{code: string}>;
  searchParams: Promise<{t?: string}>;
};

export default async function GuestEntryPage({params, searchParams}: Props) {
  const {code} = await params;
  const sp = await searchParams;
  const table = await getTableByCode(code);
  if (!table) return <InvalidLink />;

  // A tap is recorded once per NFC touch. Coming back here from the menu carries
  // ?t= along, so Hub → Karte → back stays a single tap_event.
  const tapId = cleanTapId(sp.t) ?? (await recordTap(table.id, table.venue.id));

  if (table.venue.hubEnabled) {
    const [blocks, hasMenuItems] = await Promise.all([
      getVenueHubBlocks(table.venue.id),
      venueHasMenuItems(table.venue.id)
    ]);
    const visible = visibleHubBlocks(blocks, {hasMenuItems});
    // Every block hidden would be a dead end — fall through to the stars.
    if (visible.length > 0) {
      return <Hub code={code} tapId={tapId} venue={table.venue} blocks={visible} />;
    }
  }

  return <StarRating code={code} tapId={tapId} venue={table.venue} />;
}
```

- [ ] **Step 5: Add `src/app/f/[code]/bewerten/page.tsx`**

```tsx
import {getTableByCode, recordTap, cleanTapId} from '@/lib/guest';
import {InvalidLink} from '../../invalid-link';
import {StarRating} from '../star-rating';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{code: string}>;
  searchParams: Promise<{t?: string}>;
};

export default async function BewertenPage({params, searchParams}: Props) {
  const {code} = await params;
  const sp = await searchParams;
  const table = await getTableByCode(code);
  if (!table) return <InvalidLink />;

  // Reached from the hub with ?t=; a direct visit (shared link) starts its own tap.
  const tapId = cleanTapId(sp.t) ?? (await recordTap(table.id, table.venue.id));
  return <StarRating code={code} tapId={tapId} venue={table.venue} />;
}
```

- [ ] **Step 6: Verify the routes build and behave**

Run: `npm run lint && npx tsc --noEmit && npm run build`
Expected: all three succeed. `bewerten` must not be swallowed by the sibling `[rating]` segment — static segments win, the same way `danke` already does. Confirm the build output lists both `/f/[code]/bewerten` and `/f/[code]/[rating]`.

- [ ] **Step 7: Commit**

```bash
git add src/app/f/[code]/page.tsx src/app/f/[code]/star-rating.tsx src/app/f/[code]/hub.tsx src/app/f/[code]/bewerten/page.tsx messages/de.json
git commit -m "feat(guest): configurable hub page as the NFC landing point"
```

---

### Task 9: Guest route — the hosted menu at `/f/[code]/karte`

**Files:**
- Create: `src/app/f/[code]/karte/page.tsx`

**Interfaces:**
- Consumes: `getVenueMenu` (Task 5), `markMenuViewed` (Task 7), `buildLegend`/`formatPriceCents` (Task 3), the `guest.*` copy added in Task 8.
- Produces: route `/f/[code]/karte` accepting `?t=<uuid>`.

- [ ] **Step 1: Write the page**

Create `src/app/f/[code]/karte/page.tsx`:

```tsx
import {getTranslations} from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';
import {getTableByCode, recordTap, cleanTapId, markMenuViewed} from '@/lib/guest';
import {getVenueMenu} from '@/lib/hub';
import {buildLegend} from '@/lib/menu';
import {formatPriceCents} from '@/lib/money';
import {InvalidLink} from '../../invalid-link';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{code: string}>;
  searchParams: Promise<{t?: string}>;
};

export default async function KartePage({params, searchParams}: Props) {
  const {code} = await params;
  const sp = await searchParams;
  const table = await getTableByCode(code);
  const t = await getTranslations('guest');
  const tc = await getTranslations('common');
  if (!table) return <InvalidLink />;

  const tapId = cleanTapId(sp.t) ?? (await recordTap(table.id, table.venue.id));
  await markMenuViewed(tapId, table.id);

  const categories = await getVenueMenu(table.venue.id);
  const allItems = categories.flatMap((c) => c.items);
  const legend = buildLegend(allItems);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">{t('menuTitle')}</h1>
        <Link href={`/f/${code}?t=${tapId}`} className="text-sm text-muted underline">
          {tc('back')}
        </Link>
      </div>
      <p className="mt-1 text-sm text-terra">{table.venue.name}</p>

      {allItems.length === 0 ? (
        <p className="mt-8 rounded-2xl bg-card p-6 text-muted ring-1 ring-line">
          {t('menuEmpty')}
        </p>
      ) : (
        <div className="mt-8 space-y-8">
          {categories
            .filter((category) => category.items.length > 0)
            .map((category) => (
              <section key={category.id}>
                <h2 className="border-b border-line pb-2 text-sm font-semibold tracking-wide text-muted uppercase">
                  {category.name}
                </h2>
                <ul className="mt-3 space-y-4">
                  {category.items.map((item) => {
                    const price = formatPriceCents(item.priceCents);
                    const codes = [...item.allergens, ...item.additives];
                    return (
                      <li
                        key={item.id}
                        className={`flex gap-3 ${item.soldOut ? 'opacity-50' : ''}`}
                      >
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt=""
                            width={72}
                            height={72}
                            className="h-18 w-18 shrink-0 rounded-xl object-cover"
                            unoptimized
                          />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="font-medium">
                              {item.name}
                              {codes.length > 0 ? (
                                <sup className="ml-1 text-xs font-normal text-muted">
                                  {codes.join(',')}
                                </sup>
                              ) : null}
                            </p>
                            {price ? (
                              <p className="shrink-0 tabular-nums">{price}</p>
                            ) : null}
                          </div>
                          {item.description ? (
                            <p className="mt-0.5 text-sm text-muted">{item.description}</p>
                          ) : null}
                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.dietTags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-sage/10 px-2 py-0.5 text-xs text-sage"
                              >
                                {t(`diet.${tag}`)}
                              </span>
                            ))}
                            {item.soldOut ? (
                              <span className="rounded-full bg-line px-2 py-0.5 text-xs text-muted">
                                {t('soldOut')}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
        </div>
      )}

      {legend.allergens.length > 0 || legend.additives.length > 0 ? (
        <section className="mt-10 border-t border-line pt-4">
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
            {t('legendTitle')}
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            {[...legend.allergens, ...legend.additives]
              .map(([code, label]) => `${code} ${label}`)
              .join(' · ')}
          </p>
        </section>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `npm run lint && npx tsc --noEmit && npm run build`
Expected: all succeed, and `/f/[code]/karte` appears in the build output.

- [ ] **Step 3: Look at the page in a browser**

The dashboard editor does not exist yet, so seed the data directly. With `npm run dev` running:

```bash
psql "$(npx supabase status -o env | grep '^DB_URL=' | cut -d= -f2- | tr -d '"')" <<'SQL'
with v as (select id from public.venues order by created_at limit 1),
     c as (
       insert into public.menu_categories (venue_id, name, position)
       select id, 'Vorspeisen', 0 from v returning id, venue_id
     )
insert into public.menu_items (category_id, venue_id, name, description, price_cents, allergens, diet_tags, sold_out, position)
select c.id, c.venue_id, x.name, x.descr, x.price, x.allerg, x.diet, x.sold, x.pos
from c cross join (values
  ('Bruschetta', 'Tomate, Basilikum, Knoblauch', 650, array['a','g'], array['vegetarisch'], false, 0),
  ('Linsensuppe', null, 500, array['i'], array['vegan'], true, 1)
) as x(name, descr, price, allerg, diet, sold, pos);
select t.code from public.tables t join public.venues v on v.id = t.venue_id order by v.created_at limit 1;
SQL
```

Then open `http://localhost:3000/f/<the code printed above>/karte`.
Expected: prices right-aligned as `6,50 €`, the sold-out row dimmed with an "ausverkauft" badge, superscript `a,g` on Bruschetta, a green "vegetarisch" pill, and a legend reading exactly "a Glutenhaltiges Getreide · g Milch/Laktose · i Sellerie".

- [ ] **Step 4: Commit**

```bash
git add src/app/f/[code]/karte/page.tsx
git commit -m "feat(guest): hosted menu page with prices, tags and allergen legend"
```

---

### Task 10: Owner data layer and the menu-views stat

**Files:**
- Modify: `src/lib/venues.ts`, `src/app/dashboard/statistik/page.tsx`, `messages/de.json`, `tests/integration/stats.test.ts`

**Interfaces:**
- Consumes: `venues.hub_enabled`, `venues.hub_tagline`, `tap_events.menu_viewed_at` (Task 1).
- Produces:
  - `Venue` gains `hubEnabled: boolean` and `hubTagline: string | null`.
  - `VenueStats` gains `menuViews: number`.

- [ ] **Step 1: Update the existing stats test to expect the new field**

In `tests/integration/stats.test.ts`, extend the seeded rows in `beforeAll` — replace the `tap_events` insert array with:

```ts
  await admin.from('tap_events').insert([
    {table_id: tableId, venue_id: venueId, outcome: 'opened', created_at: nowDate},
    {table_id: tableId, venue_id: venueId, outcome: 'opened', created_at: nowDate, menu_viewed_at: nowDate},
    {table_id: tableId, venue_id: venueId, outcome: 'google_redirect', created_at: nowDate},
    {table_id: tableId, venue_id: venueId, outcome: 'google_redirect', created_at: nowDate, menu_viewed_at: nowDate},
    {table_id: tableId, venue_id: venueId, outcome: 'private_feedback', created_at: nowDate},
    {table_id: tableId, venue_id: venueId, outcome: 'opened', created_at: oldDate, menu_viewed_at: oldDate} // outside window
  ]);
```

and update both assertions:

```ts
    expect(stats).toEqual({taps: 5, google: 2, feedback: 1, menuViews: 2, conversionPercent: 60});
```

```ts
    expect(stats).toEqual({taps: 0, google: 0, feedback: 0, menuViews: 0, conversionPercent: 0});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:integration -- stats`
Expected: FAIL — received object is missing `menuViews`.

- [ ] **Step 3: Extend `src/lib/venues.ts`**

Add the two hub fields to the `Venue` type, the `VenueRow` type, `toVenue`, and `VENUE_COLS`:

```ts
export type Venue = {
  id: string;
  name: string;
  slug: string;
  googlePlaceId: string | null;
  googleReviewUrl: string | null;
  logoUrl: string | null;
  hubEnabled: boolean;
  hubTagline: string | null;
};

type VenueRow = {
  id: string; name: string; slug: string;
  google_place_id: string | null; google_review_url: string | null; logo_url: string | null;
  hub_enabled: boolean; hub_tagline: string | null;
};

function toVenue(r: VenueRow): Venue {
  return {
    id: r.id, name: r.name, slug: r.slug,
    googlePlaceId: r.google_place_id,
    googleReviewUrl: r.google_review_url,
    logoUrl: r.logo_url,
    hubEnabled: r.hub_enabled,
    hubTagline: r.hub_tagline
  };
}

const VENUE_COLS =
  'id, name, slug, google_place_id, google_review_url, logo_url, hub_enabled, hub_tagline';
```

Then widen `VenueStats` and `getVenueStats`:

```ts
export type VenueStats = {
  taps: number;
  google: number;
  feedback: number;
  menuViews: number;
  conversionPercent: number;
};
```

Inside `getVenueStats`, add a second counter next to `countOutcome` and include it in the `Promise.all`:

```ts
  async function countMenuViews(): Promise<number> {
    const {count} = await supabase
      .from('tap_events')
      .select('id', {count: 'exact', head: true})
      .eq('venue_id', venueId)
      .gte('created_at', since)
      .not('menu_viewed_at', 'is', null);
    return count ?? 0;
  }

  const [taps, google, feedback, menuViews] = await Promise.all([
    countOutcome(),
    countOutcome('google_redirect'),
    countOutcome('private_feedback'),
    countMenuViews()
  ]);

  return {
    taps,
    google,
    feedback,
    menuViews,
    // Unchanged meaning: a menu view is engagement, not a conversion.
    conversionPercent: taps === 0 ? 0 : Math.round(((google + feedback) / taps) * 100)
  };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:integration -- stats`
Expected: PASS.

- [ ] **Step 5: Show the new number on the stats page**

In `messages/de.json`, add to the `"stats"` object:

```json
    "menuViews": "Speisekarte geöffnet",
```

In `src/app/dashboard/statistik/page.tsx`, add the tile and let four tiles wrap on small screens — replace the `tiles` array and the grid `div`:

```tsx
  const tiles = [
    {label: t('taps'), value: stats.taps},
    {label: t('menuViews'), value: stats.menuViews},
    {label: t('google'), value: stats.google},
    {label: t('feedback'), value: stats.feedback}
  ];
```

```tsx
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
```

- [ ] **Step 6: Verify**

Run: `npm run lint && npx tsc --noEmit && npm run test:integration -- stats`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/venues.ts src/app/dashboard/statistik/page.tsx messages/de.json tests/integration/stats.test.ts
git commit -m "feat(stats): count menu views alongside the rating funnel"
```

---

### Task 11: Dashboard — the Link-Seite editor

**Files:**
- Create: `src/app/dashboard/linkseite/page.tsx`, `src/app/dashboard/linkseite/actions.ts`
- Modify: `src/app/dashboard/layout.tsx`, `messages/de.json`

**Interfaces:**
- Consumes: `normalizeLinkUrl` (Task 2), `reorderIds` (Task 4), `Venue.hubEnabled`/`hubTagline` (Task 10).
- Produces: server actions `updateHubSettings`, `addCustomLink`, `updateCustomLink`, `updateBuiltinLink`, `setLinkEnabled`, `moveLink`, `deleteLink`, each taking a `FormData` and redirecting to `/dashboard/linkseite`.

> **Gotcha:** a module carrying the `'use server'` directive may export **only async functions**. Constants shared with the page (`MAX_CUSTOM_LINKS`) live in `src/lib/links.ts`, never in `actions.ts`.

- [ ] **Step 1: Add the German copy**

In `messages/de.json`, add a `"saved"` key to the existing `"common"` object, then change `nav.tables` and add two nav keys:

```json
  "common": { ... "saved": "Gespeichert" },
  "nav": {
    "feedback": "Feedback",
    "tables": "Tische & QR",
    "menu": "Speisekarte",
    "hub": "Link-Seite",
    "stats": "Statistik",
    "settings": "Einstellungen"
  },
```

Also change `tables.title` from `"Tische & Links"` to `"Tische & QR-Codes"`, so "Links" unambiguously means the new page.

Add a new top-level `"hub"` object:

```json
  "hub": {
    "title": "Link-Seite",
    "intro": "Das sehen Gäste, wenn sie die NFC-Karte antippen.",
    "enabledLabel": "Gäste landen zuerst auf der Link-Seite",
    "enabledHint": "Ausgeschaltet sehen Gäste sofort die Sternebewertung wie bisher.",
    "taglineLabel": "Kurzer Untertitel (optional)",
    "taglinePlaceholder": "z. B. Frisch geröstet seit 1998",
    "blocksTitle": "Buttons",
    "builtinHint": "Speisekarte und Bewerten führen in die App. Sie lassen sich umbenennen, ausblenden und umsortieren, aber nicht löschen.",
    "menuMissingHint": "Der Speisekarte-Button erscheint für Gäste erst, sobald die Karte mindestens ein Gericht enthält.",
    "labelLabel": "Beschriftung",
    "iconLabel": "Symbol",
    "urlLabel": "Link",
    "urlPlaceholder": "z. B. instagram.com/cafesonne",
    "addTitle": "Eigenen Link hinzufügen",
    "addButton": "Hinzufügen",
    "show": "Einblenden",
    "hide": "Ausblenden",
    "hidden": "ausgeblendet",
    "moveUp": "Nach oben",
    "moveDown": "Nach unten",
    "previewButton": "Link-Seite ansehen",
    "invalidUrl": "Dieser Link ist ungültig. Erlaubt sind https-Adressen sowie tel:- und mailto:-Links.",
    "tooMany": "Mehr als {max} eigene Links sind nicht möglich."
  },
```

- [ ] **Step 2: Add the two nav tabs**

In `src/app/dashboard/layout.tsx`, insert two links into the `<nav>`, between the tables link and the stats link:

```tsx
        <Link href="/dashboard/speisekarte" className="flex-1 rounded-xl px-3 py-2 text-center text-sm font-medium hover:bg-cream">{t('menu')}</Link>
        <Link href="/dashboard/linkseite" className="flex-1 rounded-xl px-3 py-2 text-center text-sm font-medium hover:bg-cream">{t('hub')}</Link>
```

Also loosen the nav items so six tabs do not squash: change `flex-1` to `flex-1 whitespace-nowrap` on all six links (the row already has `overflow-x-auto`).

- [ ] **Step 3: Write the server actions**

Create `src/app/dashboard/linkseite/actions.ts`:

```ts
'use server';

import {redirect} from 'next/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {MAX_CUSTOM_LINKS, normalizeLinkUrl} from '@/lib/links';
import {reorderIds} from '@/lib/reorder';

const BACK = '/dashboard/linkseite';

export async function updateHubSettings(formData: FormData) {
  const venueId = String(formData.get('venueId') ?? '');
  const hubEnabled = formData.get('hubEnabled') === 'on';
  const tagline = String(formData.get('hubTagline') ?? '').trim().slice(0, 160) || null;

  const supabase = await createSupabaseServerClient();
  const {error} = await supabase
    .from('venues')
    .update({hub_enabled: hubEnabled, hub_tagline: tagline})
    .eq('id', venueId);
  if (error) console.error('updateHubSettings failed:', error);
  redirect(`${BACK}?gespeichert=1`);
}

export async function addCustomLink(formData: FormData) {
  const venueId = String(formData.get('venueId') ?? '');
  const label = String(formData.get('label') ?? '').trim().slice(0, 40);
  const icon = String(formData.get('icon') ?? '').trim().slice(0, 8) || null;
  const url = normalizeLinkUrl(formData.get('url'));
  if (!venueId || !label || !url) redirect(`${BACK}?fehler=url`);

  const supabase = await createSupabaseServerClient();
  const {count} = await supabase
    .from('venue_links')
    .select('id', {count: 'exact', head: true})
    .eq('venue_id', venueId)
    .eq('kind', 'custom');
  if ((count ?? 0) >= MAX_CUSTOM_LINKS) redirect(`${BACK}?fehler=limit`);

  const {data: last} = await supabase
    .from('venue_links')
    .select('position')
    .eq('venue_id', venueId)
    .order('position', {ascending: false})
    .limit(1)
    .maybeSingle();

  const {error} = await supabase.from('venue_links').insert({
    venue_id: venueId,
    kind: 'custom',
    label,
    icon,
    url,
    position: (last?.position ?? -1) + 1
  });
  if (error) console.error('addCustomLink failed:', error);
  redirect(`${BACK}?gespeichert=1`);
}

export async function updateCustomLink(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const label = String(formData.get('label') ?? '').trim().slice(0, 40);
  const icon = String(formData.get('icon') ?? '').trim().slice(0, 8) || null;
  const url = normalizeLinkUrl(formData.get('url'));
  if (!id || !label || !url) redirect(`${BACK}?fehler=url`);

  const supabase = await createSupabaseServerClient();
  // kind filter as well as RLS: a built-in block may never acquire a URL.
  const {error} = await supabase
    .from('venue_links')
    .update({label, icon, url})
    .eq('id', id)
    .eq('kind', 'custom');
  if (error) console.error('updateCustomLink failed:', error);
  redirect(`${BACK}?gespeichert=1`);
}

export async function updateBuiltinLink(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const label = String(formData.get('label') ?? '').trim().slice(0, 40);
  const icon = String(formData.get('icon') ?? '').trim().slice(0, 8) || null;
  if (!id || !label) redirect(`${BACK}?fehler=url`);

  const supabase = await createSupabaseServerClient();
  const {error} = await supabase
    .from('venue_links')
    .update({label, icon})
    .eq('id', id)
    .neq('kind', 'custom');
  if (error) console.error('updateBuiltinLink failed:', error);
  redirect(`${BACK}?gespeichert=1`);
}

export async function setLinkEnabled(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const enabled = String(formData.get('enabled') ?? '') === 'true';
  const supabase = await createSupabaseServerClient();
  const {error} = await supabase.from('venue_links').update({enabled}).eq('id', id);
  if (error) console.error('setLinkEnabled failed:', error);
  redirect(BACK);
}

export async function moveLink(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const venueId = String(formData.get('venueId') ?? '');
  const direction = formData.get('direction') === 'up' ? 'up' : 'down';

  const supabase = await createSupabaseServerClient();
  const {data: rows} = await supabase
    .from('venue_links')
    .select('id, position')
    .eq('venue_id', venueId);

  const ordered = (rows ?? [])
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    .map((r) => r.id);
  const next = reorderIds(ordered, id, direction);
  if (next) {
    // Renumbering the whole list, not just the swapped pair, also repairs any
    // duplicate or gapped positions left by earlier edits.
    await Promise.all(
      next.map((rid, index) =>
        supabase.from('venue_links').update({position: index}).eq('id', rid)
      )
    );
  }
  redirect(BACK);
}

export async function deleteLink(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const supabase = await createSupabaseServerClient();
  // Built-in blocks are toggled off, never deleted.
  const {error} = await supabase.from('venue_links').delete().eq('id', id).eq('kind', 'custom');
  if (error) console.error('deleteLink failed:', error);
  redirect(BACK);
}
```

- [ ] **Step 4: Write the page**

Create `src/app/dashboard/linkseite/page.tsx`:

```tsx
import {getTranslations} from 'next-intl/server';
import {redirect} from 'next/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {getActiveVenue} from '@/lib/venues';
import {MAX_CUSTOM_LINKS} from '@/lib/links';
import {
  addCustomLink,
  deleteLink,
  moveLink,
  setLinkEnabled,
  updateBuiltinLink,
  updateCustomLink,
  updateHubSettings
} from './actions';

type Props = {searchParams: Promise<{gespeichert?: string; fehler?: string}>};

const FIELD = 'rounded-xl border border-line bg-card p-3';
const ICON_BUTTON = 'rounded-lg border border-line px-2 py-1 text-xs';

export default async function LinkseitePage({searchParams}: Props) {
  const venue = await getActiveVenue();
  if (!venue) redirect('/dashboard/onboarding');

  const sp = await searchParams;
  const t = await getTranslations('hub');
  const tc = await getTranslations('common');

  const supabase = await createSupabaseServerClient();
  const [{data: links}, {count: itemCount}, {data: firstTable}] = await Promise.all([
    supabase
      .from('venue_links')
      .select('id, kind, label, icon, url, enabled, position')
      .eq('venue_id', venue.id)
      .order('position'),
    supabase
      .from('menu_items')
      .select('id', {count: 'exact', head: true})
      .eq('venue_id', venue.id),
    supabase.from('tables').select('code').eq('venue_id', venue.id).order('created_at').limit(1).maybeSingle()
  ]);

  const rows = links ?? [];

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('intro')}</p>
      </div>

      {sp.gespeichert ? (
        <p className="rounded-xl bg-card p-3 text-sm text-sage ring-1 ring-sage">✓ {tc('saved')}</p>
      ) : null}
      {sp.fehler === 'url' ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{t('invalidUrl')}</p>
      ) : null}
      {sp.fehler === 'limit' ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {t('tooMany', {max: MAX_CUSTOM_LINKS})}
        </p>
      ) : null}

      <form action={updateHubSettings} className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-line">
        <input type="hidden" name="venueId" value={venue.id} />
        <label className="flex items-start gap-3">
          <input type="checkbox" name="hubEnabled" defaultChecked={venue.hubEnabled} className="mt-1" />
          <span>
            <span className="text-sm font-medium">{t('enabledLabel')}</span>
            <span className="block text-xs text-muted">{t('enabledHint')}</span>
          </span>
        </label>
        <div>
          <label htmlFor="hubTagline" className="text-sm font-medium">{t('taglineLabel')}</label>
          <input
            id="hubTagline"
            name="hubTagline"
            defaultValue={venue.hubTagline ?? ''}
            maxLength={160}
            placeholder={t('taglinePlaceholder')}
            className={`mt-1 w-full ${FIELD}`}
          />
        </div>
        <button type="submit" className="rounded-xl bg-terra px-4 py-2 font-medium text-white">
          {tc('save')}
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="font-medium">{t('blocksTitle')}</h2>
        <p className="text-xs text-muted">{t('builtinHint')}</p>
        {(itemCount ?? 0) === 0 ? (
          <p className="text-xs text-muted">{t('menuMissingHint')}</p>
        ) : null}

        <ul className="space-y-3">
          {rows.map((row, index) => (
            <li key={row.id} className="rounded-2xl bg-card p-4 ring-1 ring-line">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted">
                  {row.kind === 'custom' ? row.url : `/${row.kind}`}
                  {row.enabled ? '' : ` · ${t('hidden')}`}
                </span>
                <div className="flex shrink-0 gap-1">
                  <form action={moveLink}>
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="venueId" value={venue.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button type="submit" disabled={index === 0} className={`${ICON_BUTTON} disabled:opacity-30`} aria-label={t('moveUp')}>▲</button>
                  </form>
                  <form action={moveLink}>
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="venueId" value={venue.id} />
                    <input type="hidden" name="direction" value="down" />
                    <button type="submit" disabled={index === rows.length - 1} className={`${ICON_BUTTON} disabled:opacity-30`} aria-label={t('moveDown')}>▼</button>
                  </form>
                  <form action={setLinkEnabled}>
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="enabled" value={row.enabled ? 'false' : 'true'} />
                    <button type="submit" className={ICON_BUTTON}>
                      {row.enabled ? t('hide') : t('show')}
                    </button>
                  </form>
                  {row.kind === 'custom' ? (
                    <form action={deleteLink}>
                      <input type="hidden" name="id" value={row.id} />
                      <button type="submit" className={`${ICON_BUTTON} text-red-700`}>{tc('delete')}</button>
                    </form>
                  ) : null}
                </div>
              </div>

              <form
                action={row.kind === 'custom' ? updateCustomLink : updateBuiltinLink}
                className="mt-3 flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="id" value={row.id} />
                <div className="w-16">
                  <label htmlFor={`icon-${row.id}`} className="text-xs text-muted">{t('iconLabel')}</label>
                  <input id={`icon-${row.id}`} name="icon" defaultValue={row.icon ?? ''} maxLength={8} className={`w-full ${FIELD}`} />
                </div>
                <div className="min-w-32 flex-1">
                  <label htmlFor={`label-${row.id}`} className="text-xs text-muted">{t('labelLabel')}</label>
                  <input id={`label-${row.id}`} name="label" defaultValue={row.label} required maxLength={40} className={`w-full ${FIELD}`} />
                </div>
                {row.kind === 'custom' ? (
                  <div className="min-w-full">
                    <label htmlFor={`url-${row.id}`} className="text-xs text-muted">{t('urlLabel')}</label>
                    <input id={`url-${row.id}`} name="url" defaultValue={row.url ?? ''} required maxLength={500} className={`w-full ${FIELD}`} />
                  </div>
                ) : null}
                <button type="submit" className="rounded-xl border border-line px-4 py-3 text-sm font-medium">
                  {tc('save')}
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <form action={addCustomLink} className="space-y-2 rounded-2xl bg-card p-4 ring-1 ring-line">
        <h2 className="font-medium">{t('addTitle')}</h2>
        <input type="hidden" name="venueId" value={venue.id} />
        <div className="flex gap-2">
          <input name="icon" maxLength={8} placeholder={t('iconLabel')} aria-label={t('iconLabel')} className={`w-16 ${FIELD}`} />
          <input name="label" required maxLength={40} placeholder={t('labelLabel')} aria-label={t('labelLabel')} className={`flex-1 ${FIELD}`} />
        </div>
        <input name="url" required maxLength={500} placeholder={t('urlPlaceholder')} aria-label={t('urlLabel')} className={`w-full ${FIELD}`} />
        <button type="submit" className="rounded-xl bg-terra px-4 py-2 font-medium text-white">
          {t('addButton')}
        </button>
      </form>

      {firstTable ? (
        <a
          href={`/f/${firstTable.code}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm text-muted underline"
        >
          {t('previewButton')}
        </a>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: Verify by hand**

Run: `npm run lint && npx tsc --noEmit && npm run dev`
Then, signed in: open `/dashboard/linkseite`, tick the hub switch, save, add an Instagram link with `instagram.com/test`, reorder it above Bewerten, hide it, show it, delete it. Try to save `javascript:alert(1)` as a URL.
Expected: the URL is rejected with the German error banner and nothing is written; ▲ on the first row and ▼ on the last are disabled; the Speisekarte hint appears while the menu is empty.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/linkseite messages/de.json src/app/dashboard/layout.tsx
git commit -m "feat(dashboard): link page editor with reorderable blocks"
```

---

### Task 12: Dashboard — menu categories

**Files:**
- Create: `src/app/dashboard/speisekarte/page.tsx`, `src/app/dashboard/speisekarte/actions.ts`
- Modify: `messages/de.json`

**Interfaces:**
- Consumes: `reorderIds` (Task 4), the `menu_categories` table (Task 1).
- Produces: server actions `addCategory`, `renameCategory`, `moveCategory`, `deleteCategory`, all taking `FormData` and redirecting to `/dashboard/speisekarte`. Route `/dashboard/speisekarte/[categoryId]` is linked from here and built in Task 13.

> **Gotcha for every server action in this task and the next:** `redirect()` works by throwing. Never call it inside a `try` block whose `catch` would swallow the throw — put the `redirect()` in the `catch`, or outside the `try` entirely.

- [ ] **Step 1: Add the German copy**

In `messages/de.json`, add a new top-level `"menu"` object (sibling of `"hub"`):

```json
  "menu": {
    "title": "Speisekarte",
    "intro": "Kategorien und Gerichte. Gäste erreichen die Karte über den Speisekarte-Button auf der Link-Seite.",
    "addCategoryLabel": "Neue Kategorie",
    "addCategoryPlaceholder": "z. B. Vorspeisen",
    "addCategoryButton": "Anlegen",
    "emptyCategories": "Noch keine Kategorien. Legen Sie die erste an.",
    "itemCount": "{count, plural, =0 {Keine Gerichte} one {1 Gericht} other {# Gerichte}}",
    "editItems": "Gerichte bearbeiten",
    "categoryNameLabel": "Name der Kategorie",
    "deleteCategoryHint": "Löscht auch alle Gerichte dieser Kategorie.",
    "moveUp": "Nach oben",
    "moveDown": "Nach unten"
  },
```

- [ ] **Step 2: Write the actions**

Create `src/app/dashboard/speisekarte/actions.ts`:

```ts
'use server';

import {redirect} from 'next/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
import {reorderIds} from '@/lib/reorder';

const BACK = '/dashboard/speisekarte';

export async function addCategory(formData: FormData) {
  const venueId = String(formData.get('venueId') ?? '');
  const name = String(formData.get('name') ?? '').trim().slice(0, 60);
  if (venueId && name) {
    const supabase = await createSupabaseServerClient();
    const {data: last} = await supabase
      .from('menu_categories')
      .select('position')
      .eq('venue_id', venueId)
      .order('position', {ascending: false})
      .limit(1)
      .maybeSingle();
    const {error} = await supabase
      .from('menu_categories')
      .insert({venue_id: venueId, name, position: (last?.position ?? -1) + 1});
    if (error) console.error('addCategory failed:', error);
  }
  redirect(BACK);
}

export async function renameCategory(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim().slice(0, 60);
  if (id && name) {
    const supabase = await createSupabaseServerClient();
    const {error} = await supabase.from('menu_categories').update({name}).eq('id', id);
    if (error) console.error('renameCategory failed:', error);
  }
  redirect(BACK);
}

export async function moveCategory(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const venueId = String(formData.get('venueId') ?? '');
  const direction = formData.get('direction') === 'up' ? 'up' : 'down';

  const supabase = await createSupabaseServerClient();
  const {data: rows} = await supabase
    .from('menu_categories')
    .select('id, position')
    .eq('venue_id', venueId);

  const ordered = (rows ?? [])
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    .map((r) => r.id);
  const next = reorderIds(ordered, id, direction);
  if (next) {
    await Promise.all(
      next.map((rid, index) =>
        supabase.from('menu_categories').update({position: index}).eq('id', rid)
      )
    );
  }
  redirect(BACK);
}

export async function deleteCategory(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const supabase = await createSupabaseServerClient();

  // The `on delete cascade` removes the item rows but knows nothing about
  // Storage, so the photos have to go first or they are orphaned forever.
  const {data: items} = await supabase
    .from('menu_items')
    .select('id, venue_id')
    .eq('category_id', id);
  if (items && items.length > 0) {
    const admin = createSupabaseAdminClient();
    const paths = items.flatMap((i) => [
      `${i.venue_id}/${i.id}.png`,
      `${i.venue_id}/${i.id}.jpg`
    ]);
    const {error: storageError} = await admin.storage.from('menu-images').remove(paths);
    // Best effort: a leftover file is cheaper than a delete the owner cannot complete.
    if (storageError) console.error('deleteCategory storage cleanup failed:', storageError);
  }

  const {error} = await supabase.from('menu_categories').delete().eq('id', id);
  if (error) console.error('deleteCategory failed:', error);
  redirect(BACK);
}
```

- [ ] **Step 3: Write the page**

Create `src/app/dashboard/speisekarte/page.tsx`:

```tsx
import {getTranslations} from 'next-intl/server';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {getActiveVenue} from '@/lib/venues';
import {addCategory, deleteCategory, moveCategory, renameCategory} from './actions';

const FIELD = 'rounded-xl border border-line bg-card p-3';
const ICON_BUTTON = 'rounded-lg border border-line px-2 py-1 text-xs';

export default async function SpeisekartePage() {
  const venue = await getActiveVenue();
  if (!venue) redirect('/dashboard/onboarding');

  const t = await getTranslations('menu');
  const tc = await getTranslations('common');

  const supabase = await createSupabaseServerClient();
  const {data: categories} = await supabase
    .from('menu_categories')
    // Embed resolves through menu_items_category_same_venue; if PostgREST ever
    // calls it ambiguous, write `menu_items!menu_items_category_same_venue (id)`.
    .select('id, name, position, menu_items (id)')
    .eq('venue_id', venue.id)
    .order('position');

  const rows = (categories ?? []) as Array<{
    id: string;
    name: string;
    position: number;
    menu_items: Array<{id: string}>;
  }>;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('intro')}</p>
      </div>

      <form action={addCategory} className="flex gap-2">
        <input type="hidden" name="venueId" value={venue.id} />
        <input
          name="name"
          required
          maxLength={60}
          placeholder={t('addCategoryPlaceholder')}
          aria-label={t('addCategoryLabel')}
          className={`flex-1 ${FIELD}`}
        />
        <button type="submit" className="rounded-xl bg-terra px-4 py-2 font-medium text-white">
          {t('addCategoryButton')}
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-2xl bg-card p-6 text-muted ring-1 ring-line">
          {t('emptyCategories')}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row, index) => (
            <li key={row.id} className="rounded-2xl bg-card p-4 ring-1 ring-line">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted">
                  {t('itemCount', {count: row.menu_items.length})}
                </span>
                <div className="flex shrink-0 gap-1">
                  <form action={moveCategory}>
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="venueId" value={venue.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button type="submit" disabled={index === 0} className={`${ICON_BUTTON} disabled:opacity-30`} aria-label={t('moveUp')}>▲</button>
                  </form>
                  <form action={moveCategory}>
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="venueId" value={venue.id} />
                    <input type="hidden" name="direction" value="down" />
                    <button type="submit" disabled={index === rows.length - 1} className={`${ICON_BUTTON} disabled:opacity-30`} aria-label={t('moveDown')}>▼</button>
                  </form>
                  <form action={deleteCategory}>
                    <input type="hidden" name="id" value={row.id} />
                    <button type="submit" title={t('deleteCategoryHint')} className={`${ICON_BUTTON} text-red-700`}>
                      {tc('delete')}
                    </button>
                  </form>
                </div>
              </div>

              <form action={renameCategory} className="mt-3 flex gap-2">
                <input type="hidden" name="id" value={row.id} />
                <input
                  name="name"
                  defaultValue={row.name}
                  required
                  maxLength={60}
                  aria-label={t('categoryNameLabel')}
                  className={`flex-1 ${FIELD}`}
                />
                <button type="submit" className="rounded-xl border border-line px-4 py-3 text-sm font-medium">
                  {tc('save')}
                </button>
              </form>

              <Link
                href={`/dashboard/speisekarte/${row.id}`}
                className="mt-3 inline-block text-sm text-terra underline"
              >
                {t('editItems')} →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify by hand**

Run: `npm run lint && npx tsc --noEmit && npm run dev`
Then open `/dashboard/speisekarte`: add "Vorspeisen" and "Hauptgerichte", rename one, move one down, delete one.
Expected: the counter reads "Keine Gerichte" for a fresh category; ▲/▼ disable at the ends. The "Gerichte bearbeiten" link 404s until Task 13.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/speisekarte messages/de.json
git commit -m "feat(dashboard): menu category management"
```

---

### Task 13: Dashboard — menu items, with browser-side photo downscaling

**Files:**
- Create: `src/app/dashboard/speisekarte/[categoryId]/page.tsx`, `src/app/dashboard/speisekarte/[categoryId]/actions.ts`, `src/components/image-upload-field.tsx`
- Modify: `messages/de.json`

**Interfaces:**
- Consumes: `parsePriceInput` (Task 3); `filterDietTags`/`filterAllergens`/`filterAdditives`, `DIET_TAGS`, `ALLERGENS`, `ADDITIVES` (Task 3); `reorderIds` (Task 4); `fitWithin`, `MAX_IMAGE_EDGE` (Task 4); `sniffImageType` from `@/lib/images`.
- Produces: server actions `addMenuItem`, `updateMenuItem`, `moveMenuItem`, `deleteMenuItem`, `uploadItemImage`, `removeItemImage`; client component `<ImageUploadField name label hint />`.

- [ ] **Step 1: Add the German copy**

Add these keys inside the existing `"menu"` object from Task 12:

```json
    "itemsTitle": "Gerichte",
    "backToCategories": "← Alle Kategorien",
    "nameLabel": "Name",
    "namePlaceholder": "z. B. Bruschetta",
    "descriptionLabel": "Beschreibung",
    "descriptionPlaceholder": "z. B. Tomate, Basilikum, Knoblauch",
    "priceLabel": "Preis",
    "pricePlaceholder": "14,00",
    "priceHint": "Leer lassen für Tagespreis.",
    "dietLabel": "Kennzeichnung",
    "allergensLabel": "Allergene",
    "additivesLabel": "Zusatzstoffe",
    "multiSelectHint": "Mehrfachauswahl mit Strg/Cmd.",
    "soldOutLabel": "Ausverkauft",
    "photoLabel": "Foto (PNG oder JPG, max. 3 MB)",
    "photoHint": "Wird im Browser automatisch verkleinert.",
    "photoButton": "Foto hochladen",
    "photoRemove": "Foto entfernen",
    "photoAlt": "Foto von {name}",
    "addItemTitle": "Neues Gericht",
    "addItemButton": "Gericht hinzufügen",
    "emptyItems": "Noch keine Gerichte in dieser Kategorie.",
    "invalidPrice": "Bitte einen Preis wie 14,00 eingeben.",
    "invalidName": "Bitte einen Namen eingeben.",
    "uploadFailed": "Das Foto konnte nicht gespeichert werden. Erlaubt sind PNG und JPG bis 3 MB."
```

- [ ] **Step 2: Write the client photo field**

Create `src/components/image-upload-field.tsx`:

```tsx
'use client';

import {useState} from 'react';
import {fitWithin, MAX_IMAGE_EDGE} from '@/lib/resize';

// `name` is the form field name the server action reads and is the same for
// every row; `id` is per-item so each label points at its own input.
type Props = {name: string; id: string; label: string; hint: string; buttonLabel: string};

// A menu of unscaled phone photos is tens of megabytes, so the browser shrinks
// each file before it is submitted. Progressive enhancement holds: without JS
// the original file is sent and the server still enforces type, magic bytes
// and the 3 MB cap.
export function ImageUploadField({name, id, label, hint, buttonLabel}: Props) {
  const [busy, setBusy] = useState(false);

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      const {width, height} = fitWithin(bitmap.width, bitmap.height, MAX_IMAGE_EDGE);
      bitmap.close();
      if (width === bitmap.width && height === bitmap.height && file.size <= 400_000) return;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) return;
      const redraw = await createImageBitmap(file);
      context.drawImage(redraw, 0, 0, width, height);
      redraw.close();

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.82)
      );
      if (!blob) return;

      const transfer = new DataTransfer();
      transfer.items.add(new File([blob], 'foto.jpg', {type: 'image/jpeg'}));
      input.files = transfer.files;
    } catch {
      // Downscaling is an optimisation. If the browser cannot do it, send the
      // original and let the server decide.
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs text-muted">{label}</label>
      <input
        id={id}
        name={name}
        type="file"
        accept="image/png,image/jpeg"
        required
        onChange={handleChange}
        className="w-full rounded-xl border border-line bg-card p-2 text-sm"
      />
      <p className="text-xs text-muted">{hint}</p>
      <button
        type="submit"
        disabled={busy}
        className="rounded-xl border border-line px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {buttonLabel}
      </button>
    </div>
  );
}
```

Note the bitmap is decoded twice on purpose: `createImageBitmap` gives dimensions, and the first handle is closed before the canvas draw so a large photo is not held in memory twice.

- [ ] **Step 3: Write the item actions**

Create `src/app/dashboard/speisekarte/[categoryId]/actions.ts`:

```ts
'use server';

import {redirect} from 'next/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
import {sniffImageType} from '@/lib/images';
import {parsePriceInput} from '@/lib/money';
import {filterAdditives, filterAllergens, filterDietTags} from '@/lib/menu';
import {reorderIds} from '@/lib/reorder';

const ALLOWED_ITEM_IMAGE_TYPES: Record<string, string> = {'image/png': 'png', 'image/jpeg': 'jpg'};
const MAX_ITEM_IMAGE_BYTES = 3 * 1024 * 1024;

function backTo(categoryId: string, query = ''): string {
  return `/dashboard/speisekarte/${categoryId}${query}`;
}

function readItemFields(formData: FormData) {
  return {
    name: String(formData.get('name') ?? '').trim().slice(0, 120),
    description: String(formData.get('description') ?? '').trim().slice(0, 400) || null,
    diet_tags: filterDietTags(formData.getAll('dietTags')),
    allergens: filterAllergens(formData.getAll('allergens')),
    additives: filterAdditives(formData.getAll('additives')),
    sold_out: formData.get('soldOut') === 'on'
  };
}

export async function addMenuItem(formData: FormData) {
  const categoryId = String(formData.get('categoryId') ?? '');
  const venueId = String(formData.get('venueId') ?? '');
  const fields = readItemFields(formData);
  if (!categoryId || !venueId || !fields.name) redirect(backTo(categoryId, '?fehler=name'));

  // redirect() throws, so it must live in the catch, never inside the try.
  let priceCents: number | null;
  try {
    priceCents = parsePriceInput(formData.get('price'));
  } catch {
    redirect(backTo(categoryId, '?fehler=preis'));
  }

  const supabase = await createSupabaseServerClient();
  const {data: last} = await supabase
    .from('menu_items')
    .select('position')
    .eq('category_id', categoryId)
    .order('position', {ascending: false})
    .limit(1)
    .maybeSingle();

  const {error} = await supabase.from('menu_items').insert({
    category_id: categoryId,
    venue_id: venueId,
    ...fields,
    price_cents: priceCents,
    position: (last?.position ?? -1) + 1
  });
  if (error) console.error('addMenuItem failed:', error);
  redirect(backTo(categoryId, '?gespeichert=1'));
}

export async function updateMenuItem(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const categoryId = String(formData.get('categoryId') ?? '');
  const fields = readItemFields(formData);
  if (!id || !fields.name) redirect(backTo(categoryId, '?fehler=name'));

  let priceCents: number | null;
  try {
    priceCents = parsePriceInput(formData.get('price'));
  } catch {
    redirect(backTo(categoryId, '?fehler=preis'));
  }

  const supabase = await createSupabaseServerClient();
  const {error} = await supabase
    .from('menu_items')
    .update({...fields, price_cents: priceCents})
    .eq('id', id);
  if (error) console.error('updateMenuItem failed:', error);
  redirect(backTo(categoryId, '?gespeichert=1'));
}

export async function moveMenuItem(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const categoryId = String(formData.get('categoryId') ?? '');
  const direction = formData.get('direction') === 'up' ? 'up' : 'down';

  const supabase = await createSupabaseServerClient();
  const {data: rows} = await supabase
    .from('menu_items')
    .select('id, position')
    .eq('category_id', categoryId);

  const ordered = (rows ?? [])
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    .map((r) => r.id);
  const next = reorderIds(ordered, id, direction);
  if (next) {
    await Promise.all(
      next.map((rid, index) =>
        supabase.from('menu_items').update({position: index}).eq('id', rid)
      )
    );
  }
  redirect(backTo(categoryId));
}

export async function deleteMenuItem(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const categoryId = String(formData.get('categoryId') ?? '');

  const supabase = await createSupabaseServerClient();
  const {data: item} = await supabase
    .from('menu_items')
    .select('id, venue_id')
    .eq('id', id)
    .maybeSingle();

  if (item) {
    const admin = createSupabaseAdminClient();
    const {error: storageError} = await admin.storage
      .from('menu-images')
      .remove([`${item.venue_id}/${id}.png`, `${item.venue_id}/${id}.jpg`]);
    if (storageError) console.error('deleteMenuItem storage cleanup failed:', storageError);

    const {error} = await supabase.from('menu_items').delete().eq('id', id);
    if (error) console.error('deleteMenuItem failed:', error);
  }
  redirect(backTo(categoryId));
}

export async function uploadItemImage(formData: FormData) {
  const itemId = String(formData.get('itemId') ?? '');
  const categoryId = String(formData.get('categoryId') ?? '');
  const file = formData.get('photo');

  if (!(file instanceof File) || file.size === 0 || file.size > MAX_ITEM_IMAGE_BYTES) {
    redirect(backTo(categoryId, '?fehler=foto'));
  }
  const ext = ALLOWED_ITEM_IMAGE_TYPES[file.type];
  if (!ext) redirect(backTo(categoryId, '?fehler=foto'));

  // Never trust the declared MIME type: check the real leading bytes.
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (sniffImageType(head) !== ext) redirect(backTo(categoryId, '?fehler=foto'));

  // Ownership through the RLS client BEFORE the service-role client touches Storage.
  const supabase = await createSupabaseServerClient();
  const {data: item} = await supabase
    .from('menu_items')
    .select('id, venue_id')
    .eq('id', itemId)
    .maybeSingle();
  if (!item) redirect(backTo(categoryId, '?fehler=foto'));

  const admin = createSupabaseAdminClient();
  // Remove both extensions first, so a JPG replacing a PNG cannot orphan the old file.
  await admin.storage
    .from('menu-images')
    .remove([`${item.venue_id}/${itemId}.png`, `${item.venue_id}/${itemId}.jpg`]);

  const path = `${item.venue_id}/${itemId}.${ext}`;
  const {error} = await admin.storage
    .from('menu-images')
    .upload(path, file, {upsert: true, contentType: file.type});
  if (error) {
    console.error('uploadItemImage failed:', error);
    redirect(backTo(categoryId, '?fehler=foto'));
  }

  const {data: pub} = admin.storage.from('menu-images').getPublicUrl(path);
  // Cache-bust: the path is reused on re-upload, so a version param forces refetch.
  const {error: updateError} = await supabase
    .from('menu_items')
    .update({image_url: `${pub.publicUrl}?v=${Date.now()}`})
    .eq('id', itemId);
  if (updateError) console.error('uploadItemImage update failed:', updateError);
  redirect(backTo(categoryId, '?gespeichert=1'));
}

export async function removeItemImage(formData: FormData) {
  const itemId = String(formData.get('itemId') ?? '');
  const categoryId = String(formData.get('categoryId') ?? '');

  const supabase = await createSupabaseServerClient();
  const {data: item} = await supabase
    .from('menu_items')
    .select('id, venue_id')
    .eq('id', itemId)
    .maybeSingle();
  if (item) {
    const admin = createSupabaseAdminClient();
    const {error: storageError} = await admin.storage
      .from('menu-images')
      .remove([`${item.venue_id}/${itemId}.png`, `${item.venue_id}/${itemId}.jpg`]);
    if (storageError) console.error('removeItemImage storage cleanup failed:', storageError);
    const {error} = await supabase.from('menu_items').update({image_url: null}).eq('id', itemId);
    if (error) console.error('removeItemImage failed:', error);
  }
  redirect(backTo(categoryId));
}
```

- [ ] **Step 4: Write the item page**

Create `src/app/dashboard/speisekarte/[categoryId]/page.tsx`:

```tsx
import {getTranslations} from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';
import {notFound, redirect} from 'next/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {getActiveVenue} from '@/lib/venues';
import {ADDITIVES, ALLERGENS, DIET_TAGS} from '@/lib/menu';
import {ImageUploadField} from '@/components/image-upload-field';
import {
  addMenuItem,
  deleteMenuItem,
  moveMenuItem,
  removeItemImage,
  updateMenuItem,
  uploadItemImage
} from './actions';

type Props = {
  params: Promise<{categoryId: string}>;
  searchParams: Promise<{gespeichert?: string; fehler?: string}>;
};

const FIELD = 'rounded-xl border border-line bg-card p-3';
const ICON_BUTTON = 'rounded-lg border border-line px-2 py-1 text-xs';

type ItemRow = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  diet_tags: string[];
  allergens: string[];
  additives: string[];
  image_url: string | null;
  sold_out: boolean;
  position: number;
};

export default async function KategoriePage({params, searchParams}: Props) {
  const venue = await getActiveVenue();
  if (!venue) redirect('/dashboard/onboarding');

  const {categoryId} = await params;
  const sp = await searchParams;
  const t = await getTranslations('menu');
  const tc = await getTranslations('common');

  const supabase = await createSupabaseServerClient();
  // RLS scopes this to the owner's venues, so an unknown or foreign id is a 404.
  const {data: category} = await supabase
    .from('menu_categories')
    .select('id, name')
    .eq('id', categoryId)
    .maybeSingle();
  if (!category) notFound();

  const {data: items} = await supabase
    .from('menu_items')
    .select('id, name, description, price_cents, diet_tags, allergens, additives, image_url, sold_out, position')
    .eq('category_id', categoryId)
    .order('position');
  const rows = (items ?? []) as ItemRow[];

  // Shared between the "new item" form and every edit form.
  function fieldset(item?: ItemRow) {
    const key = item?.id ?? 'neu';
    return (
      <>
        <div>
          <label htmlFor={`name-${key}`} className="text-xs text-muted">{t('nameLabel')}</label>
          <input id={`name-${key}`} name="name" defaultValue={item?.name ?? ''} required maxLength={120}
            placeholder={t('namePlaceholder')} className={`w-full ${FIELD}`} />
        </div>
        <div>
          <label htmlFor={`desc-${key}`} className="text-xs text-muted">{t('descriptionLabel')}</label>
          <textarea id={`desc-${key}`} name="description" defaultValue={item?.description ?? ''} rows={2} maxLength={400}
            placeholder={t('descriptionPlaceholder')} className={`w-full ${FIELD}`} />
        </div>
        <div>
          <label htmlFor={`price-${key}`} className="text-xs text-muted">{t('priceLabel')}</label>
          <input id={`price-${key}`} name="price"
            defaultValue={item?.price_cents == null ? '' : (item.price_cents / 100).toFixed(2).replace('.', ',')}
            inputMode="decimal" placeholder={t('pricePlaceholder')} className={`w-full ${FIELD}`} />
          <p className="text-xs text-muted">{t('priceHint')}</p>
        </div>
        <fieldset>
          <legend className="text-xs text-muted">{t('dietLabel')}</legend>
          <div className="mt-1 flex flex-wrap gap-3">
            {DIET_TAGS.map((tag) => (
              <label key={tag} className="flex items-center gap-1 text-sm">
                <input type="checkbox" name="dietTags" value={tag} defaultChecked={item?.diet_tags.includes(tag)} />
                {tag}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label htmlFor={`allergens-${key}`} className="text-xs text-muted">{t('allergensLabel')}</label>
            <select id={`allergens-${key}`} name="allergens" multiple size={5} defaultValue={item?.allergens ?? []}
              className={`w-full ${FIELD}`}>
              {Object.entries(ALLERGENS).map(([code, label]) => (
                <option key={code} value={code}>{code} — {label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`additives-${key}`} className="text-xs text-muted">{t('additivesLabel')}</label>
            <select id={`additives-${key}`} name="additives" multiple size={5} defaultValue={item?.additives ?? []}
              className={`w-full ${FIELD}`}>
              {Object.entries(ADDITIVES).map(([code, label]) => (
                <option key={code} value={code}>{code} — {label}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-muted">{t('multiSelectHint')}</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="soldOut" defaultChecked={item?.sold_out ?? false} />
          {t('soldOutLabel')}
        </label>
      </>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link href="/dashboard/speisekarte" className="text-sm text-muted underline">
        {t('backToCategories')}
      </Link>
      <h1 className="text-xl font-semibold">{category.name}</h1>

      {sp.gespeichert ? (
        <p className="rounded-xl bg-card p-3 text-sm text-sage ring-1 ring-sage">✓ {tc('saved')}</p>
      ) : null}
      {sp.fehler === 'preis' ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{t('invalidPrice')}</p>
      ) : null}
      {sp.fehler === 'name' ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{t('invalidName')}</p>
      ) : null}
      {sp.fehler === 'foto' ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{t('uploadFailed')}</p>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-2xl bg-card p-6 text-muted ring-1 ring-line">{t('emptyItems')}</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((item, index) => (
            <li key={item.id} className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-line">
              <div className="flex items-start justify-between gap-2">
                {item.image_url ? (
                  <Image src={item.image_url} alt={t('photoAlt', {name: item.name})} width={64} height={64}
                    className="h-16 w-16 rounded-xl object-cover" unoptimized />
                ) : null}
                <div className="flex shrink-0 gap-1">
                  <form action={moveMenuItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="categoryId" value={categoryId} />
                    <input type="hidden" name="direction" value="up" />
                    <button type="submit" disabled={index === 0} className={`${ICON_BUTTON} disabled:opacity-30`} aria-label={t('moveUp')}>▲</button>
                  </form>
                  <form action={moveMenuItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="categoryId" value={categoryId} />
                    <input type="hidden" name="direction" value="down" />
                    <button type="submit" disabled={index === rows.length - 1} className={`${ICON_BUTTON} disabled:opacity-30`} aria-label={t('moveDown')}>▼</button>
                  </form>
                  <form action={deleteMenuItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="categoryId" value={categoryId} />
                    <button type="submit" className={`${ICON_BUTTON} text-red-700`}>{tc('delete')}</button>
                  </form>
                </div>
              </div>

              <form action={updateMenuItem} className="space-y-3">
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="categoryId" value={categoryId} />
                {fieldset(item)}
                <button type="submit" className="rounded-xl bg-terra px-4 py-2 font-medium text-white">
                  {tc('save')}
                </button>
              </form>

              <form action={uploadItemImage} className="border-t border-line pt-3">
                <input type="hidden" name="itemId" value={item.id} />
                <input type="hidden" name="categoryId" value={categoryId} />
                <ImageUploadField
                  name="photo"
                  id={`photo-${item.id}`}
                  label={t('photoLabel')}
                  hint={t('photoHint')}
                  buttonLabel={t('photoButton')}
                />
              </form>
              {item.image_url ? (
                <form action={removeItemImage}>
                  <input type="hidden" name="itemId" value={item.id} />
                  <input type="hidden" name="categoryId" value={categoryId} />
                  <button type="submit" className="text-xs text-red-700 underline">{t('photoRemove')}</button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <form action={addMenuItem} className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-line">
        <h2 className="font-medium">{t('addItemTitle')}</h2>
        <input type="hidden" name="categoryId" value={categoryId} />
        <input type="hidden" name="venueId" value={venue.id} />
        {fieldset()}
        <button type="submit" className="rounded-xl bg-terra px-4 py-2 font-medium text-white">
          {t('addItemButton')}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Verify by hand**

Run: `npm run lint && npx tsc --noEmit && npm run dev`
Then, in a category: add "Bruschetta" at 6,50 with allergens a and g; edit it to sold out; add an item with the price left empty; try the price "vierzehn"; upload a large photo from disk; remove the photo; reorder two items; delete one.
Expected: the German price error appears for "vierzehn" and nothing is written; the empty price saves as no price; the uploaded photo appears as a thumbnail and, in DevTools → Network, the request body is well under the original file size (the browser downscaled it); removing the photo clears the thumbnail.

- [ ] **Step 6: Verify the whole guest side end to end by hand**

Open `/f/<code>` for that venue with the hub enabled.
Expected: the hub now shows the Speisekarte button (it was hidden while the menu was empty), the menu renders the item with `6,50 €` and the superscript `a,g`, and the legend at the bottom lists exactly "a Glutenhaltiges Getreide · g Milch/Laktose".

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/speisekarte/[categoryId] src/components/image-upload-field.tsx messages/de.json
git commit -m "feat(dashboard): menu item editor with browser-side photo downscaling"
```

---

### Task 14: End-to-end coverage of the guest journey

**Files:**
- Create: `e2e/hub-flow.spec.ts`

**Interfaces:**
- Consumes: everything. This task is the proof that the pieces fit.
- Produces: nothing.

- [ ] **Step 1: Write the spec**

Create `e2e/hub-flow.spec.ts`:

```ts
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
  const {data: hubVenue} = await admin
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
    .single();

  hubCode = `H${stamp.toString(36)}`.slice(0, 7).padEnd(7, 'h');
  const {data: hubTable} = await admin
    .from('tables')
    .insert({venue_id: hubVenue!.id, label: 'Tisch 1', code: hubCode})
    .select('id')
    .single();
  hubTableId = hubTable!.id;

  const {data: category} = await admin
    .from('menu_categories')
    .insert({venue_id: hubVenue!.id, name: 'Vorspeisen', position: 0})
    .select('id')
    .single();
  await admin.from('menu_items').insert({
    category_id: category!.id,
    venue_id: hubVenue!.id,
    name: 'Bruschetta',
    description: 'Tomate, Basilikum',
    price_cents: 650,
    allergens: ['a', 'g'],
    diet_tags: ['vegetarisch'],
    position: 0
  });

  // Second venue with the hub off — the regression guard.
  const {data: plainVenue} = await admin
    .from('venues')
    .insert({owner_id: ownerId, name: 'Klassik Café', slug: `e2e-plain-${stamp}`})
    .select('id')
    .single();
  plainCode = `P${stamp.toString(36)}`.slice(0, 7).padEnd(7, 'p');
  await admin
    .from('tables')
    .insert({venue_id: plainVenue!.id, label: 'Tisch 1', code: plainCode});
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
```

- [ ] **Step 2: Run the suite**

Run: `npm run build && npm run e2e`
Expected: all four new tests pass, and the three pre-existing tests in `e2e/guest-flow.spec.ts` still pass — that venue has `hub_enabled` at its default `false`, so its behaviour is unchanged.

- [ ] **Step 3: Run everything once more**

Run: `npm run lint && npx tsc --noEmit && npm test && npm run e2e`
Expected: lint clean, no type errors, all unit and integration tests green, all e2e green.

- [ ] **Step 4: Commit**

```bash
git add e2e/hub-flow.spec.ts
git commit -m "test(e2e): hub journey, single-tap accounting and no-hub regression guard"
```
