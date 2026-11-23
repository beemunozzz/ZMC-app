-- ZMC Hub, step 8: crew clock-in (Zach can turn it on or off on the Payroll page).

-- 1. The on/off switch. Starts off.
alter table public.settings add column if not exists clock_in_enabled boolean not null default false;

create or replace function public.clock_in_on()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select clock_in_enabled from public.settings where id = 1), false)
$$;
revoke execute on function public.clock_in_on() from public, anon;
grant execute on function public.clock_in_on() to authenticated;

-- 2. Time entries: one row per clock-in. At most one open entry per person.
create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crew_members (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  created_at timestamptz not null default now(),
  check (clock_out is null or clock_out >= clock_in)
);
create unique index if not exists time_entries_one_open on public.time_entries (crew_id) where clock_out is null;
create index if not exists time_entries_clock_in_idx on public.time_entries (clock_in);

-- 3. Crew can't fudge times: for anyone but the owner, the server clock sets clock-in and clock-out.
create or replace function public.time_entry_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.my_role() is distinct from 'owner' then
    if tg_op = 'INSERT' then
      new.clock_in := now();
      new.clock_out := null;
    elsif tg_op = 'UPDATE' then
      if old.clock_out is not null then
        raise exception 'ZMC: this time entry is already closed';
      end if;
      new.crew_id := old.crew_id;
      new.job_id := old.job_id;
      new.clock_in := old.clock_in;
      new.clock_out := now();
    end if;
  end if;
  return new;
end
$$;
revoke execute on function public.time_entry_guard() from public, anon, authenticated;

drop trigger if exists time_entry_guard on public.time_entries;
create trigger time_entry_guard before insert or update on public.time_entries
  for each row execute function public.time_entry_guard();

-- 4. Security rules.
alter table public.time_entries enable row level security;

drop policy if exists "See time" on public.time_entries;
create policy "See time" on public.time_entries
  for select to authenticated using (
    public.my_role() = 'owner'
    or crew_id = public.my_crew_id()
    or (job_id is not null and public.is_job_lead(job_id))
  );

drop policy if exists "Clock in" on public.time_entries;
create policy "Clock in" on public.time_entries
  for insert to authenticated with check (
    public.my_role() = 'owner' or (crew_id = public.my_crew_id() and public.clock_in_on())
  );

drop policy if exists "Clock out" on public.time_entries;
create policy "Clock out" on public.time_entries
  for update to authenticated
  using (public.my_role() = 'owner' or crew_id = public.my_crew_id())
  with check (public.my_role() = 'owner' or crew_id = public.my_crew_id());

drop policy if exists "Owner deletes time" on public.time_entries;
create policy "Owner deletes time" on public.time_entries
  for delete to authenticated using (public.my_role() = 'owner');

grant select, insert, update, delete on public.time_entries to authenticated;
revoke all on public.time_entries from anon;
