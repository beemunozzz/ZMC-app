-- ZMC Hub, step 23: "Truck reserved" on jobs where we bring our truck (the U-Haul is booked).
alter table public.jobs add column if not exists truck_reserved_at timestamptz;
alter table public.jobs add column if not exists truck_reserved_by uuid references public.crew_members (id) on delete set null;

-- Zach or the job's crew lead ticks or unticks it. Returns 'ok' or a reason.
create or replace function public.set_truck_reserved(p_job uuid, p_on boolean)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if public.my_role() is distinct from 'owner' and not public.is_job_lead(p_job) then return 'not_allowed'; end if;
  update public.jobs
    set truck_reserved_at = case when p_on then coalesce(truck_reserved_at, now()) end,
        truck_reserved_by = case when p_on then coalesce(truck_reserved_by, public.my_crew_id()) end
  where id = p_job;
  if not found then return 'not_found'; end if;
  return 'ok';
end
$$;
revoke execute on function public.set_truck_reserved(uuid, boolean) from public, anon;
grant execute on function public.set_truck_reserved(uuid, boolean) to authenticated;
