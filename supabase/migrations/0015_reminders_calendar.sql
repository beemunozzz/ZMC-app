-- ZMC Hub, step 15: crew "remind me the night before" switch, private calendar links,
-- and the lookups the nightly reminder and the calendar app use (they run without anyone logged in).

-- 1. Crew preferences (one row per person; missing row = defaults).
create table if not exists public.crew_prefs (
  crew_id uuid primary key references public.crew_members (id) on delete cascade,
  remind_night_before boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.crew_prefs enable row level security;
drop policy if exists "My prefs" on public.crew_prefs;
create policy "My prefs" on public.crew_prefs
  for all to authenticated
  using (crew_id = public.my_crew_id() or public.my_role() = 'owner')
  with check (crew_id = public.my_crew_id() or public.my_role() = 'owner');
grant select, insert, update on public.crew_prefs to authenticated;
revoke all on public.crew_prefs from anon;

-- 2. Private calendar link: a long random code per person. Anyone with the link can read
--    that person's job times and addresses, so it can be reset (delete the row, make a new one).
create table if not exists public.calendar_feeds (
  crew_id uuid primary key references public.crew_members (id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);
alter table public.calendar_feeds enable row level security;
drop policy if exists "My calendar link" on public.calendar_feeds;
create policy "My calendar link" on public.calendar_feeds
  for all to authenticated using (crew_id = public.my_crew_id()) with check (crew_id = public.my_crew_id());
grant select, insert, delete on public.calendar_feeds to authenticated;
revoke all on public.calendar_feeds from anon;

-- The calendar app asks for jobs with the code. Same visibility rules as the app:
-- on leave = nothing; on call = only the day before to the day after; otherwise the last 30 days and next 4 months.
create or replace function public.calendar_jobs(p_token text)
returns table (
  id uuid, job_date date, start_time time, est_hours numeric, status text, job_type text,
  customer_name text, pickup_address text, dropoff_address text, is_lead boolean, crew_names text
) language sql stable security definer set search_path = '' as $$
  with me as (
    select c.id, c.employment from public.calendar_feeds f
    join public.crew_members c on c.id = f.crew_id and c.active
    where f.token = p_token and length(p_token) >= 40
  ), today as (select (now() at time zone 'America/Los_Angeles')::date as d)
  select j.id, j.job_date, j.start_time, j.est_hours, j.status, j.job_type,
         j.customer_name, j.pickup_address, j.dropoff_address, j.lead_id = me.id,
         (select string_agg(c2.full_name, ', ' order by c2.full_name) from public.crew_members c2
           where c2.id = j.lead_id or c2.id = any (j.crew_ids))
  from public.jobs j, me, today
  where (j.lead_id = me.id or me.id = any (j.crew_ids))
    and j.status <> 'canceled'
    and me.employment <> 'leave'
    and (case when me.employment = 'on_call' then j.job_date between today.d - 1 and today.d + 1
              else j.job_date between today.d - 30 and today.d + 120 end)
$$;
revoke execute on function public.calendar_jobs(text) from public;
grant execute on function public.calendar_jobs(text) to anon, authenticated;

-- 3. Nightly reminder. Vercel's timer calls the app with a secret key; the database keeps only a
--    fingerprint (hash) of that key, which the owner saves from the app during setup.
create table if not exists public.cron_key (
  id int primary key default 1 check (id = 1),
  key_hash text not null,
  updated_at timestamptz not null default now()
);
alter table public.cron_key enable row level security;
drop policy if exists "Owner sets the timer key" on public.cron_key;
create policy "Owner sets the timer key" on public.cron_key
  for all to authenticated using (public.my_role() = 'owner') with check (public.my_role() = 'owner');
grant select, insert, update on public.cron_key to authenticated;
revoke all on public.cron_key from anon;

-- Who to remind about tomorrow's jobs, and where their phones are. Only works with the right key.
create or replace function public.reminder_targets(p_key text)
returns table (
  crew_id uuid, endpoint text, p256dh text, auth text,
  job_id uuid, start_time time, customer_name text, pickup_address text, is_lead boolean
) language sql stable security definer set search_path = '' as $$
  select c.id, s.endpoint, s.p256dh, s.auth, j.id, j.start_time, j.customer_name, j.pickup_address, j.lead_id = c.id
  from public.jobs j
  join public.crew_members c on (c.id = j.lead_id or c.id = any (j.crew_ids)) and c.active and c.employment <> 'leave'
  join public.push_subscriptions s on s.crew_id = c.id
  left join public.crew_prefs p on p.crew_id = c.id
  where p_key is not null and length(p_key) >= 32
    and encode(sha256(convert_to(p_key, 'UTF8')), 'hex') = (select key_hash from public.cron_key where id = 1)
    and j.job_date = (now() at time zone 'America/Los_Angeles')::date + 1
    and j.status in ('booked', 'confirmed')
    and coalesce(p.remind_night_before, true)
$$;
revoke execute on function public.reminder_targets(text) from public;
grant execute on function public.reminder_targets(text) to anon, authenticated;
