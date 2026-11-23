-- ZMC Hub, step 11: terminate and rehire. This step touches logins, so Supabase asks for approval.

-- Terminate: turn off the account, block the login and sign out every phone,
-- take them off upcoming jobs, clock them out. Past jobs, hours and invoices are kept.
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

-- Rehire: turn the account back on and allow logins again.
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
