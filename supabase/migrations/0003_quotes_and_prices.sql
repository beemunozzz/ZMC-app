-- ZMC Hub, step 3: price settings and quotes.
-- Paste this whole file into Supabase > SQL Editor and press Run. Safe to run more than once.

-- 1. Price settings: one row that Zach edits on the Settings page.
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  rate numeric(8, 2) not null default 65,
  min_hours numeric(4, 1) not null default 2,
  min_movers int not null default 2,
  trip_free_miles numeric(6, 1) not null default 25,
  trip_step_miles numeric(6, 1) not null default 25 check (trip_step_miles > 0),
  trip_step_hours numeric(4, 2) not null default 0.5,
  truck_per_mile numeric(6, 2) not null default 1,
  materials numeric(8, 2) not null default 20,
  water numeric(8, 2) not null default 5,
  nte_cushion_hours numeric(4, 1) not null default 1,
  business_phone text not null default '(209) 326-5601',
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

alter table public.settings enable row level security;
drop policy if exists "Crew can read prices" on public.settings;
create policy "Crew can read prices" on public.settings
  for select to authenticated using (public.my_role() is not null);
drop policy if exists "Owner changes prices" on public.settings;
create policy "Owner changes prices" on public.settings
  for update to authenticated using (public.my_role() = 'owner') with check (public.my_role() = 'owner');
grant select, update on public.settings to authenticated;
revoke all on public.settings from anon;

-- 2. Quotes. Only the owner sees them.
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'new' check (status in ('new', 'quoted', 'booked', 'declined')),
  customer_name text not null,
  customer_phone text not null default '',
  heard_from text not null default '',
  move_date date,
  start_time time,
  job_type text not null default 'Full move',
  pickup_address text not null default '',
  pickup_house jsonb not null default '{}'::jsonb,
  dropoff_address text not null default '',
  dropoff_house jsonb not null default '{}'::jsonb,
  size text not null default '',
  heavy_items text not null default '',
  notes text not null default '',
  truck text not null default 'ours' check (truck in ('ours', 'theirs')),
  movers int not null default 2 check (movers between 1 and 12),
  est_hours numeric(4, 1),
  miles_out numeric(6, 1),
  miles_between numeric(6, 1),
  miles_back numeric(6, 1),
  quote_total numeric(10, 2),
  nte numeric(10, 2),
  job_id uuid references public.jobs (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quotes_created_idx on public.quotes (created_at desc);

drop trigger if exists quotes_touch on public.quotes;
create trigger quotes_touch before update on public.quotes
  for each row execute function public.touch_updated_at();

alter table public.quotes enable row level security;
drop policy if exists "Owner manages quotes" on public.quotes;
create policy "Owner manages quotes" on public.quotes
  for all to authenticated using (public.my_role() = 'owner') with check (public.my_role() = 'owner');
grant select, insert, update, delete on public.quotes to authenticated;
revoke all on public.quotes from anon;

-- 3. Jobs carry a not-to-exceed price and remember which quote they came from.
alter table public.jobs add column if not exists nte numeric(10, 2);
alter table public.jobs add column if not exists quote_id uuid references public.quotes (id) on delete set null;
