-- ZMC Hub, step 19: the "Developer" flag (Brandon). A developer keeps owner access, is labelled
-- "Developer", and gets the "View as" bar to preview the app as any role or person (read-only).
alter table public.crew_members add column if not exists is_dev boolean not null default false;
-- Applied Nov 25, 2026 with: update public.crew_members set is_dev = true where full_name = 'Brandon Munoz';

-- The developer can't be put on a job (lead or crew). Applied Nov 25, 2026.
create or replace function public.no_dev_on_jobs()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.crew_members where is_dev and (id = new.lead_id or id = any (new.crew_ids))) then
    raise exception 'The developer can''t be put on a job.';
  end if;
  return new;
end
$$;
revoke execute on function public.no_dev_on_jobs() from public, anon, authenticated;
create trigger no_dev_on_jobs before insert or update of lead_id, crew_ids on public.jobs
  for each row execute function public.no_dev_on_jobs();
