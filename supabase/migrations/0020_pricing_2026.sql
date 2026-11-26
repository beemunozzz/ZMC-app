-- ZMC Hub, step 20: new pricing (Dec 2026) and the owner-only truck cost settings.
-- Nothing is removed: the old trip/truck-per-mile columns stay in the table but are no longer used.

-- 1. Customer prices (crew can read these; they need them for invoices).
alter table public.settings add column if not exists allin_rate numeric(8, 2) not null default 195;
alter table public.settings add column if not exists allin_far_rate numeric(8, 2) not null default 215;
alter table public.settings add column if not exists far_miles numeric(6, 1) not null default 45;
alter table public.settings add column if not exists allin_movers int not null default 2;
alter table public.settings add column if not exists travel_free_hours numeric(4, 2) not null default 2;
alter table public.settings add column if not exists travel_mid_hours numeric(4, 2) not null default 3;
alter table public.settings add column if not exists travel_mid_charge numeric(4, 2) not null default 1;
alter table public.settings add column if not exists travel_long_share numeric(4, 2) not null default 0.5;
alter table public.settings add column if not exists long_day_hours numeric(4, 2) not null default 8;
alter table public.settings add column if not exists ot_multiplier numeric(4, 2) not null default 1.5;
alter table public.settings add column if not exists long_day_bonus numeric(8, 2) not null default 100;
-- New labor rate and minimum.
update public.settings set rate = 75, min_hours = 3 where id = 1;

-- 2. OUR costs (owner only: crew and customers can never read this table).
create table if not exists public.owner_costs (
  id int primary key default 1 check (id = 1),
  uhaul_daily numeric(8, 2) not null default 50.95,
  uhaul_per_mile numeric(6, 3) not null default 1.09,
  uhaul_coverage_day numeric(8, 2) not null default 30,
  uhaul_env_fee numeric(8, 2) not null default 5,
  sales_tax numeric(5, 4) not null default 0.09,
  truck_mpg numeric(5, 2) not null default 8,
  gas_price numeric(6, 3) not null default 5.60,
  diesel_price numeric(6, 3) not null default 7.50,
  follow_mpg numeric(5, 2) not null default 25,
  truck_pickup_cost numeric(8, 2) not null default 75,
  flat_margin numeric(5, 4) not null default 0.15,
  updated_at timestamptz not null default now()
);
insert into public.owner_costs (id) values (1) on conflict (id) do nothing;
alter table public.owner_costs enable row level security;
create policy "Owner only: costs" on public.owner_costs
  for all to authenticated using (public.my_role() = 'owner') with check (public.my_role() = 'owner');
grant select, update on public.owner_costs to authenticated;
revoke all on public.owner_costs from anon;

-- 3. Quotes (owner-only table): drive times, hourly or flat, and the truck-cost panel choices.
alter table public.quotes add column if not exists drive_out_min int;
alter table public.quotes add column if not exists drive_back_min int;
alter table public.quotes add column if not exists pricing text not null default 'hourly' check (pricing in ('hourly', 'flat'));
alter table public.quotes add column if not exists flat_price numeric(10, 2);
alter table public.quotes add column if not exists truck_cost jsonb not null default '{}'::jsonb;

-- 4. Jobs: drive time back to the shop (jobs.drive_min is already the drive out), and a flat price if booked flat.
alter table public.jobs add column if not exists drive_back_min int;
alter table public.jobs add column if not exists flat_price numeric(10, 2);

-- 5. An adjusted all-inclusive hourly rate for one quote/job (e.g. to cover a costly truck). Applied Nov 26, 2026.
alter table public.quotes add column if not exists rate_override numeric(8, 2);
alter table public.jobs add column if not exists rate_override numeric(8, 2);

-- 6. The truck's share of the hourly rate when the truck is "at cost" (replaces rate_override, which fixed the
--    whole crew's rate and didn't follow the number of movers). Rate = movers x $75 + truck_rate. Applied Nov 26, 2026.
alter table public.quotes add column if not exists truck_rate numeric(8, 2);
alter table public.jobs add column if not exists truck_rate numeric(8, 2);
