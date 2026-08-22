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
