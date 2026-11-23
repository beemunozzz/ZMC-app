-- ZMC Hub, step 16: where the crew meets for a job. Default: at the shop (Zach's house), at a meet time
-- worked out from the drive. Zach or the job's crew lead can switch the whole job to "meet at the site".
-- Anyone on the job can say "I'll meet you at the site" (own car) until 8 PM the night before.

-- 1. Shop address and the extra minutes before leaving (Zach sets both on the Prices page).
alter table public.settings add column if not exists shop_address text not null default '';
alter table public.settings add column if not exists meet_buffer_min int not null default 10;
alter table public.settings drop constraint if exists settings_meet_buffer_check;
alter table public.settings add constraint settings_meet_buffer_check check (meet_buffer_min between 0 and 120);

-- 2. Per job: where everyone meets, and an optional drive time Zach typed in (minutes, shop -> pickup).
alter table public.jobs add column if not exists meet_at text not null default 'shop';
alter table public.jobs drop constraint if exists jobs_meet_at_check;
alter table public.jobs add constraint jobs_meet_at_check check (meet_at in ('shop', 'site'));
alter table public.jobs add column if not exists drive_min int;
alter table public.jobs drop constraint if exists jobs_drive_min_check;
alter table public.jobs add constraint jobs_drive_min_check check (drive_min is null or drive_min between 0 and 600);

-- Has the 8 PM night-before cutoff passed for this job?
create or replace function public.meet_cutoff_passed(j uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select now() >= (((job_date - 1)::timestamp + time '20:00') at time zone 'America/Los_Angeles') from public.jobs where id = j),
    true)
$$;
revoke execute on function public.meet_cutoff_passed(uuid) from public, anon;
grant execute on function public.meet_cutoff_passed(uuid) to authenticated;

-- 3. "I'll meet you at the site" (one row per person per job; no row = meeting at the shop).
create table if not exists public.meet_at_site (
  job_id uuid not null references public.jobs (id) on delete cascade,
  crew_id uuid not null references public.crew_members (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (job_id, crew_id)
);
alter table public.meet_at_site enable row level security;
drop policy if exists "See who meets at the site" on public.meet_at_site;
create policy "See who meets at the site" on public.meet_at_site
  for select to authenticated using (public.my_role() = 'owner' or public.is_on_job(job_id));
drop policy if exists "Say I'll meet at the site" on public.meet_at_site;
create policy "Say I'll meet at the site" on public.meet_at_site
  for insert to authenticated with check (
    public.my_role() = 'owner'
    or (crew_id = public.my_crew_id() and public.is_on_job(job_id) and not public.meet_cutoff_passed(job_id))
  );
drop policy if exists "Take it back" on public.meet_at_site;
create policy "Take it back" on public.meet_at_site
  for delete to authenticated using (
    public.my_role() = 'owner'
    or (crew_id = public.my_crew_id() and not public.meet_cutoff_passed(job_id))
  );
grant select, insert, delete on public.meet_at_site to authenticated;
revoke all on public.meet_at_site from anon;

-- 4. Zach (any time) or the job's crew lead (until the cutoff) switches the whole job: shop or site.
create or replace function public.set_meet_at(p_job uuid, p_at text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_at not in ('shop', 'site') then raise exception 'Pick shop or site'; end if;
  if public.my_role() = 'owner' or (public.is_job_lead(p_job) and not public.meet_cutoff_passed(p_job)) then
    update public.jobs set meet_at = p_at where id = p_job;
  else
    raise exception 'Only Zach or the crew lead can change this, until 8 PM the night before';
  end if;
end
$$;
revoke execute on function public.set_meet_at(uuid, text) from public, anon;
grant execute on function public.set_meet_at(uuid, text) to authenticated;

-- 5. Notifications: crew can now also notify people on the same upcoming job as them
--    (e.g. "Dylan will meet you at the site" reaches the crew lead). Still nobody else.
create or replace function public.push_targets(p_crew uuid[], p_owners boolean)
returns table (endpoint text, p256dh text, auth text) language sql stable security definer set search_path = '' as $$
  select s.endpoint, s.p256dh, s.auth
  from public.push_subscriptions s
  join public.crew_members c on c.id = s.crew_id and c.active
  where public.my_role() is not null
    and (
      (p_owners and c.role = 'owner')
      or (public.my_role() = 'owner' and s.crew_id = any (coalesce(p_crew, '{}')))
      or (s.crew_id = public.my_crew_id() and s.crew_id = any (coalesce(p_crew, '{}'))) -- your own test notification
      or (s.crew_id = any (coalesce(p_crew, '{}')) and exists (
            select 1 from public.jobs j
            where j.job_date >= (now() at time zone 'America/Los_Angeles')::date - 1
              and j.status <> 'canceled'
              and (j.lead_id = public.my_crew_id() or public.my_crew_id() = any (j.crew_ids))
              and (j.lead_id = s.crew_id or s.crew_id = any (j.crew_ids))))
    )
$$;
revoke execute on function public.push_targets(uuid[], boolean) from public, anon;
grant execute on function public.push_targets(uuid[], boolean) to authenticated;
