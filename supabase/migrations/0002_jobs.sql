-- ZMC Hub, step 2: jobs.
-- Paste this whole file into Supabase > SQL Editor and press Run. Safe to run more than once.

-- 1. "Which crew member am I?" Used by the security rules below.
create or replace function public.my_crew_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.crew_members
  where user_id = auth.uid() and active
  limit 1
$$;

-- 2. The jobs table. House details are stored as a small bundle per address.
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  job_date date not null,
  start_time time,
  est_hours numeric(4, 1),
  pickup_address text not null default '',
  pickup_house jsonb not null default '{}'::jsonb,
  dropoff_address text not null default '',
  dropoff_house jsonb not null default '{}'::jsonb,
  customer_name text not null,
  customer_phone text not null default '',
  job_type text not null default 'Full move',
  truck text not null default 'ours' check (truck in ('ours', 'theirs')),
  status text not null default 'booked' check (status in ('booked', 'confirmed', 'done', 'canceled')),
  movers_needed int not null default 2 check (movers_needed between 1 and 12),
  lead_id uuid references public.crew_members (id) on delete set null,
  crew_ids uuid[] not null default '{}',
  heavy_items text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_job_date_idx on public.jobs (job_date);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists jobs_touch on public.jobs;
create trigger jobs_touch before update on public.jobs
  for each row execute function public.touch_updated_at();

-- 3. Security rules: the owner sees and changes every job.
--    Crew leads and movers only see the jobs they're on.
alter table public.jobs enable row level security;

drop policy if exists "See jobs" on public.jobs;
create policy "See jobs" on public.jobs
  for select to authenticated using (
    public.my_role() = 'owner'
    or lead_id = public.my_crew_id()
    or public.my_crew_id() = any (crew_ids)
  );

drop policy if exists "Owner adds jobs" on public.jobs;
create policy "Owner adds jobs" on public.jobs
  for insert to authenticated with check (public.my_role() = 'owner');

drop policy if exists "Owner edits jobs" on public.jobs;
create policy "Owner edits jobs" on public.jobs
  for update to authenticated
  using (public.my_role() = 'owner') with check (public.my_role() = 'owner');

drop policy if exists "Owner deletes jobs" on public.jobs;
create policy "Owner deletes jobs" on public.jobs
  for delete to authenticated using (public.my_role() = 'owner');

grant select, insert, update, delete on public.jobs to authenticated;
revoke all on public.jobs from anon;
