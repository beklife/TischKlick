-- === Tables ===
create table public.owners (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners (id) on delete cascade,
  name text not null,
  slug text not null unique,
  google_place_id text,
  google_review_url text,
  logo_url text,
  created_at timestamptz not null default now()
);

create table public.tables (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  label text not null,
  code text not null unique,
  created_at timestamptz not null default now()
);

create type public.tap_outcome as enum ('opened', 'google_redirect', 'private_feedback');

-- Anonymity by design: no IP, no user agent, no fingerprint columns. Ever.
create table public.tap_events (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.tables (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  outcome public.tap_outcome not null default 'opened',
  created_at timestamptz not null default now()
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  table_id uuid references public.tables (id) on delete set null,
  rating int not null check (rating between 1 and 5),
  categories text[] not null default '{}',
  comment text,
  contact text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index tap_events_venue_created_idx on public.tap_events (venue_id, created_at desc);
create index feedback_venue_created_idx on public.feedback (venue_id, created_at desc);

-- === Baseline Data API grants ===
-- Table-level GRANTs are a separate privilege layer from RLS: bypassrls (service_role)
-- skips row-security policies but NOT this object-level check, and anon/authenticated
-- get no privileges on tables they didn't create unless granted explicitly. Hosted
-- Supabase projects seed this automatically; a bare `supabase init` local project does
-- not, so it must be done here for the RLS policies below to ever be reachable.
-- Least privilege: authenticated gets only the four RLS-governed DML commands (RLS
-- policies below then filter which rows are visible/writable); anon gets schema USAGE
-- only — guest writes go through the service-role client exclusively, so anon needs
-- zero table or routine privileges; service_role keeps full access as the trusted,
-- RLS-bypassing role this block exists for. postgres is omitted — it owns the tables.
--
-- The local Postgres image also pre-seeds a default ACL (for role postgres, the role
-- migrations run as) that auto-grants TRUNCATE/REFERENCES/TRIGGER/MAINTAIN to anon and
-- authenticated on every new table. GRANT only adds privileges, so that inherited grant
-- must be explicitly revoked first, on both the tables just created and future ones.
revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

-- === Signup trigger ===
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.owners (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- === RLS ===
alter table public.owners enable row level security;
alter table public.venues enable row level security;
alter table public.tables enable row level security;
alter table public.tap_events enable row level security;
alter table public.feedback enable row level security;

create policy "owners: read own" on public.owners
  for select to authenticated using (id = (select auth.uid()));

create policy "venues: own" on public.venues
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "tables: own venue" on public.tables
  for all to authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = (select auth.uid())));

create policy "tap_events: read own venue" on public.tap_events
  for select to authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = (select auth.uid())));

create policy "feedback: read own venue" on public.feedback
  for select to authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = (select auth.uid())));

create policy "feedback: update own venue" on public.feedback
  for update to authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = (select auth.uid())));

-- Guest inserts (tap_events, feedback) happen only through the service-role
-- client in server actions, which bypasses RLS. No anon policies on purpose.

-- === Storage: public logos bucket ===
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;
