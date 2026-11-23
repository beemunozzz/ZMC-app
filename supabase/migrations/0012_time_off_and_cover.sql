-- ZMC Hub, step 12: crew time off ("I'm not available") and "Can't make this job" cover requests.

-- 1. Time off. A whole day off, or "can work until" a time (e.g. only until 3 PM).
--    7+ days ahead: approved automatically. Less than 7 days: a request Zach approves or denies.
create table if not exists public.time_off (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crew_members (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  until_time time, -- null = not available all day; set = can only work until this time
  note text not null default '',
  status text not null default 'approved' check (status in ('approved', 'pending', 'denied')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check (end_date >= start_date)
);
create index if not exists time_off_dates_idx on public.time_off (start_date, end_date);

create or replace function public.time_off_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.my_role() is distinct from 'owner' then
    -- The 7-day rule is decided here, by the server, not the phone.
    if new.start_date - (now() at time zone 'America/Los_Angeles')::date >= 7 then
      new.status := 'approved';
    else
      new.status := 'pending';
    end if;
    new.decided_at := null;
  end if;
  return new;
end
$$;
revoke execute on function public.time_off_guard() from public, anon, authenticated;
drop trigger if exists time_off_guard on public.time_off;
create trigger time_off_guard before insert on public.time_off
  for each row execute function public.time_off_guard();

alter table public.time_off enable row level security;
drop policy if exists "See time off" on public.time_off;
create policy "See time off" on public.time_off
  for select to authenticated using (public.my_role() = 'owner' or crew_id = public.my_crew_id());
drop policy if exists "Ask for time off" on public.time_off;
create policy "Ask for time off" on public.time_off
  for insert to authenticated with check (public.my_role() = 'owner' or crew_id = public.my_crew_id());
drop policy if exists "Owner decides time off" on public.time_off;
create policy "Owner decides time off" on public.time_off
  for update to authenticated using (public.my_role() = 'owner') with check (public.my_role() = 'owner');
drop policy if exists "Cancel time off" on public.time_off;
create policy "Cancel time off" on public.time_off
  for delete to authenticated using (public.my_role() = 'owner' or crew_id = public.my_crew_id());
grant select, insert, update, delete on public.time_off to authenticated;
revoke all on public.time_off from anon;

-- 2. "Can't make this job": the crew member tells Zach, Zach finds cover.
create table if not exists public.cover_requests (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  crew_id uuid not null references public.crew_members (id) on delete cascade,
  reason text not null default '',
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index if not exists cover_requests_one_open on public.cover_requests (job_id, crew_id) where status = 'open';

create or replace function public.is_on_job(j uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.jobs
    where id = j and (lead_id = public.my_crew_id() or public.my_crew_id() = any (crew_ids))
  )
$$;
revoke execute on function public.is_on_job(uuid) from public, anon;
grant execute on function public.is_on_job(uuid) to authenticated;

alter table public.cover_requests enable row level security;
drop policy if exists "See cover requests" on public.cover_requests;
create policy "See cover requests" on public.cover_requests
  for select to authenticated using (public.my_role() = 'owner' or crew_id = public.my_crew_id());
drop policy if exists "Ask for cover" on public.cover_requests;
create policy "Ask for cover" on public.cover_requests
  for insert to authenticated with check (
    public.my_role() = 'owner' or (crew_id = public.my_crew_id() and public.is_on_job(job_id))
  );
drop policy if exists "Owner resolves cover" on public.cover_requests;
create policy "Owner resolves cover" on public.cover_requests
  for update to authenticated using (public.my_role() = 'owner') with check (public.my_role() = 'owner');
drop policy if exists "Take back a cover request" on public.cover_requests;
create policy "Take back a cover request" on public.cover_requests
  for delete to authenticated using (public.my_role() = 'owner' or (crew_id = public.my_crew_id() and status = 'open'));
grant select, insert, update, delete on public.cover_requests to authenticated;
revoke all on public.cover_requests from anon;
