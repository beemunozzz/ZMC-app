-- ZMC Hub, step 14: crew "My regular schedule" (with history and Zach's approval for changes),
-- and "My info" (contact, emergency contact, driver's license, shirt size) that crew fill in themselves.

-- 1. My info. Crew fill in their own; Zach can see and fix everyone's.
create table if not exists public.crew_profile (
  crew_id uuid primary key references public.crew_members (id) on delete cascade,
  address text not null default '',
  emergency_name text not null default '',
  emergency_relation text not null default '',
  emergency_phone text not null default '',
  has_license boolean, -- null = not answered yet
  shirt_size text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.crew_profile enable row level security;
drop policy if exists "See my info" on public.crew_profile;
create policy "See my info" on public.crew_profile
  for select to authenticated using (public.my_role() = 'owner' or crew_id = public.my_crew_id());
drop policy if exists "Add my info" on public.crew_profile;
create policy "Add my info" on public.crew_profile
  for insert to authenticated with check (public.my_role() = 'owner' or crew_id = public.my_crew_id());
drop policy if exists "Change my info" on public.crew_profile;
create policy "Change my info" on public.crew_profile
  for update to authenticated
  using (public.my_role() = 'owner' or crew_id = public.my_crew_id())
  with check (public.my_role() = 'owner' or crew_id = public.my_crew_id());
grant select, insert, update on public.crew_profile to authenticated;
revoke all on public.crew_profile from anon;

-- Crew can't edit the crew list, but they can update their own phone number.
create or replace function public.save_my_phone(p_phone text)
returns void language sql security definer set search_path = '' as $$
  update public.crew_members set phone = left(trim(coalesce(p_phone, '')), 30)
  where id = public.my_crew_id() and active
$$;
revoke execute on function public.save_my_phone(text) from public, anon;
grant execute on function public.save_my_phone(text) to authenticated;

-- 2. Regular weekly schedule. Every version is kept, so Zach can always see the original.
--    days = {"mon": {"k": "all"}, "tue": {"k": "some", "from": "09:00", "until": "18:00"}, "wed": {"k": "off"}, ...}
create table if not exists public.weekly_schedules (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crew_members (id) on delete cascade,
  days jsonb not null check (jsonb_typeof(days) = 'object'),
  note text not null default '',
  status text not null default 'approved' check (status in ('approved', 'pending', 'denied')),
  is_original boolean not null default false,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists weekly_schedules_crew_idx on public.weekly_schedules (crew_id, created_at);
create unique index if not exists weekly_schedules_one_pending on public.weekly_schedules (crew_id) where status = 'pending';

-- The server decides: the first schedule is saved right away as the original.
-- After that, a crew member's change is a request Zach approves or denies.
create or replace function public.weekly_schedule_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  has_one boolean := exists (select 1 from public.weekly_schedules where crew_id = new.crew_id and status = 'approved');
begin
  new.created_at := now();
  new.is_original := not has_one;
  if public.my_role() = 'owner' or not has_one then
    new.status := 'approved';
    new.decided_at := now();
  else
    new.status := 'pending';
    new.decided_at := null;
  end if;
  return new;
end
$$;
revoke execute on function public.weekly_schedule_guard() from public, anon, authenticated;
drop trigger if exists weekly_schedule_guard on public.weekly_schedules;
create trigger weekly_schedule_guard before insert on public.weekly_schedules
  for each row execute function public.weekly_schedule_guard();

alter table public.weekly_schedules enable row level security;
drop policy if exists "See schedules" on public.weekly_schedules;
create policy "See schedules" on public.weekly_schedules
  for select to authenticated using (public.my_role() = 'owner' or crew_id = public.my_crew_id());
drop policy if exists "Add a schedule" on public.weekly_schedules;
create policy "Add a schedule" on public.weekly_schedules
  for insert to authenticated with check (public.my_role() = 'owner' or crew_id = public.my_crew_id());
drop policy if exists "Owner decides schedule changes" on public.weekly_schedules;
create policy "Owner decides schedule changes" on public.weekly_schedules
  for update to authenticated using (public.my_role() = 'owner') with check (public.my_role() = 'owner');
-- Only a waiting request can be taken back. Approved and denied versions stay as the record.
drop policy if exists "Take back a schedule request" on public.weekly_schedules;
create policy "Take back a schedule request" on public.weekly_schedules
  for delete to authenticated using (status = 'pending' and (public.my_role() = 'owner' or crew_id = public.my_crew_id()));
grant select, insert, update, delete on public.weekly_schedules to authenticated;
revoke all on public.weekly_schedules from anon;
