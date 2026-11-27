-- ZMC Hub, step 24: low-hours alert and typical crew pay.

-- 1. Typical crew pay ($/hr), owner only. Used for the estimated job profit on quotes until real pay rates are set.
alter table public.owner_costs add column if not exists crew_pay_rate numeric(6, 2) not null default 20;

-- 2. "Got it" on a low-hours alert: one row per crew member per week. Owner only.
create table if not exists public.hours_alert_acks (
  week_start date not null,
  crew_id uuid not null references public.crew_members (id) on delete cascade,
  acked_at timestamptz not null default now(),
  primary key (week_start, crew_id)
);
alter table public.hours_alert_acks enable row level security;
create policy "Owner manages hours alerts" on public.hours_alert_acks
  for all to authenticated using (public.my_role() = 'owner') with check (public.my_role() = 'owner');
grant select, insert, update, delete on public.hours_alert_acks to authenticated;
revoke all on public.hours_alert_acks from anon;

-- 3. For the nightly timer (no login): full-time crew at or under p_max scheduled hours that week, not yet acknowledged.
--    Needs the server's secret key (CRON_SECRET), like owner_push_targets.
create or replace function public.low_hours_targets(p_key text, p_week date, p_max numeric)
returns table (crew_id uuid, full_name text, hours numeric)
language sql stable security definer set search_path = '' as $$
  select c.id, c.full_name,
    coalesce((select sum(coalesce(j.est_hours, 0)) from public.jobs j
              where j.status <> 'canceled' and j.job_date between p_week and p_week + 6
                and (j.lead_id = c.id or c.id = any (j.crew_ids))), 0) as hours
  from public.crew_members c
  where p_key is not null and length(p_key) >= 32
    and encode(sha256(convert_to(p_key, 'UTF8')), 'hex') = (select key_hash from public.cron_key where id = 1)
    and c.active and c.role <> 'owner' and not c.is_dev and coalesce(c.employment, 'full_time') = 'full_time'
    and not exists (select 1 from public.hours_alert_acks a where a.week_start = p_week and a.crew_id = c.id)
    and coalesce((select sum(coalesce(j.est_hours, 0)) from public.jobs j
              where j.status <> 'canceled' and j.job_date between p_week and p_week + 6
                and (j.lead_id = c.id or c.id = any (j.crew_ids))), 0) <= p_max
$$;
revoke execute on function public.low_hours_targets(text, date, numeric) from public;
grant execute on function public.low_hours_targets(text, date, numeric) to anon, authenticated;
