-- ZMC Hub, step 10: employee file, raises, employment types (full-time, part-time, on call, leave),
-- and the on-call "still working tomorrow?" check. Owner-only info stays in owner-only tables.

-- 1. Private employee info lives with pay (owner-only table).
alter table public.crew_pay add column if not exists address text not null default '';
alter table public.crew_pay add column if not exists emergency_name text not null default '';
alter table public.crew_pay add column if not exists emergency_phone text not null default '';
alter table public.crew_pay add column if not exists hire_date date;
alter table public.crew_pay add column if not exists notes text not null default '';
alter table public.crew_pay add column if not exists terminated_at timestamptz;
alter table public.crew_pay add column if not exists termination_date date;
alter table public.crew_pay add column if not exists termination_reason text not null default '';

-- 2. Pay history (raises).
create table if not exists public.pay_changes (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crew_members (id) on delete cascade,
  old_rate numeric(6, 2),
  new_rate numeric(6, 2) not null check (new_rate >= 0),
  effective_date date not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
alter table public.pay_changes enable row level security;
drop policy if exists "Owner manages pay history" on public.pay_changes;
create policy "Owner manages pay history" on public.pay_changes
  for all to authenticated using (public.my_role() = 'owner') with check (public.my_role() = 'owner');
grant select, insert, update, delete on public.pay_changes to authenticated;
revoke all on public.pay_changes from anon;

-- 3. Employment type. Controls what someone sees when they log in.
alter table public.crew_members add column if not exists employment text not null default 'full_time';
alter table public.crew_members drop constraint if exists crew_members_employment_check;
alter table public.crew_members add constraint crew_members_employment_check
  check (employment in ('full_time', 'part_time', 'on_call', 'leave'));

-- Can I see a job on this date?
--   full-time / part-time: yes.  On call: only from the day before to the day after.  On leave: no.
create or replace function public.can_see_job_date(d date)
returns boolean language sql stable security definer set search_path = '' as $$
  select case coalesce((select employment from public.crew_members where user_id = auth.uid() and active limit 1), 'full_time')
    when 'leave' then false
    when 'on_call' then d between ((now() at time zone 'America/Los_Angeles')::date - 1)
                              and ((now() at time zone 'America/Los_Angeles')::date + 1)
    else true
  end
$$;
revoke execute on function public.can_see_job_date(date) from public, anon;
grant execute on function public.can_see_job_date(date) to authenticated;

drop policy if exists "See jobs" on public.jobs;
create policy "See jobs" on public.jobs
  for select to authenticated using (
    public.my_role() = 'owner'
    or ((lead_id = public.my_crew_id() or public.my_crew_id() = any (crew_ids)) and public.can_see_job_date(job_date))
  );

-- 4. "Is this on-call person still working tomorrow?" answers (owner only).
create table if not exists public.oncall_checks (
  job_id uuid not null references public.jobs (id) on delete cascade,
  crew_id uuid not null references public.crew_members (id) on delete cascade,
  answer text not null check (answer in ('yes', 'no')),
  answered_at timestamptz not null default now(),
  primary key (job_id, crew_id)
);
alter table public.oncall_checks enable row level security;
drop policy if exists "Owner manages on-call checks" on public.oncall_checks;
create policy "Owner manages on-call checks" on public.oncall_checks
  for all to authenticated using (public.my_role() = 'owner') with check (public.my_role() = 'owner');
grant select, insert, update, delete on public.oncall_checks to authenticated;
revoke all on public.oncall_checks from anon;
