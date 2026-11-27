-- ZMC Hub, step 26: keep the weather after the day passes. The forecast only covers upcoming days, so the app
-- saves the last forecast for each day (Stockton) and each job; past days and jobs show what it was.

-- Stockton's weather per day: { kind, text, hi, pop } and working-hours temps { lo, hi }.
create table if not exists public.weather_days (
  day date primary key,
  wx jsonb,
  temps jsonb,
  updated_at timestamptz not null default now()
);
alter table public.weather_days enable row level security;
create policy "Everyone on the crew sees saved weather" on public.weather_days
  for select to authenticated using (public.my_role() is not null);
create policy "Owner saves weather" on public.weather_days
  for insert to authenticated with check (public.my_role() = 'owner');
create policy "Owner updates weather" on public.weather_days
  for update to authenticated using (public.my_role() = 'owner') with check (public.my_role() = 'owner');
grant select, insert, update on public.weather_days to authenticated;
revoke all on public.weather_days from anon;

-- Each job's saved weather: the same shape the app shows (kind, text, hi, pop, where, stops, atSite) plus temps.
alter table public.jobs add column if not exists wx_saved jsonb;
