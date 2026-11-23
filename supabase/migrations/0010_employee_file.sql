-- ZMC Hub, step 10: employee file (owner only), raises, terminate and rehire.

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

-- 3. Terminate: turn off the account, block the login and sign out every phone,
--    take them off upcoming jobs, clock them out. Past jobs, hours and invoices are kept.
create or replace function public.terminate_employee(p_crew uuid, p_date date, p_reason text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  uid uuid;
  n int := 0;
  from_date date := coalesce(p_date, (now() at time zone 'America/Los_Angeles')::date);
begin
  if public.my_role() is distinct from 'owner' then
    raise exception 'ZMC: only the owner can terminate an employee';
  end if;
  if p_crew = public.my_crew_id() then
    raise exception 'ZMC: you can''t terminate yourself';
  end if;
  select user_id into uid from public.crew_members where id = p_crew;
  if not found then
    raise exception 'ZMC: employee not found';
  end if;

  update public.crew_members set active = false where id = p_crew;

  insert into public.crew_pay (crew_id, terminated_at, termination_date, termination_reason)
  values (p_crew, now(), from_date, coalesce(p_reason, ''))
  on conflict (crew_id) do update
    set terminated_at = now(), termination_date = from_date, termination_reason = coalesce(p_reason, ''), updated_at = now();

  update public.time_entries set clock_out = now() where crew_id = p_crew and clock_out is null;

  with changed as (
    update public.jobs
       set lead_id = case when lead_id = p_crew then null else lead_id end,
           crew_ids = array_remove(crew_ids, p_crew)
     where job_date >= from_date
       and status in ('booked', 'confirmed')
       and (lead_id = p_crew or p_crew = any (crew_ids))
    returning 1
  )
  select count(*) into n from changed;

  if uid is not null then
    update auth.users set banned_until = 'infinity' where id = uid;
    delete from auth.sessions where user_id = uid;
    delete from auth.refresh_tokens where user_id = uid::text;
  end if;

  return json_build_object('jobs_updated', n, 'had_login', uid is not null);
end
$$;

-- 4. Rehire: turn the account back on and allow logins again.
create or replace function public.rehire_employee(p_crew uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid;
begin
  if public.my_role() is distinct from 'owner' then
    raise exception 'ZMC: only the owner can rehire an employee';
  end if;
  select user_id into uid from public.crew_members where id = p_crew;
  if not found then
    raise exception 'ZMC: employee not found';
  end if;
  update public.crew_members set active = true where id = p_crew;
  update public.crew_pay set terminated_at = null, termination_date = null, termination_reason = '', updated_at = now() where crew_id = p_crew;
  if uid is not null then
    update auth.users set banned_until = null where id = uid;
  end if;
end
$$;

revoke execute on function public.terminate_employee(uuid, date, text) from public, anon;
revoke execute on function public.rehire_employee(uuid) from public, anon;
grant execute on function public.terminate_employee(uuid, date, text) to authenticated;
grant execute on function public.rehire_employee(uuid) to authenticated;
