-- ZMC Hub, step 25: weather heads-ups. The nightly timer checks each job's weather (pickup, the drive, drop-off)
-- for the next 2 days and tells Zach and the job's lead when it turns bad. It remembers what it last told them.
alter table public.jobs add column if not exists wx_kind text;   -- last weather we told people about ('rain', 'wind'...), null = fine
alter table public.jobs add column if not exists wx_where text;  -- where ("Livermore", "the drive")

-- Jobs in a date range for the nightly timer (no login; needs the server's secret key, like reminder_targets).
create or replace function public.weather_jobs(p_key text, p_from date, p_to date)
returns table (id uuid, job_date date, customer_name text, pickup_address text, dropoff_address text, lead_id uuid, wx_kind text, wx_where text)
language sql stable security definer set search_path = '' as $$
  select j.id, j.job_date, j.customer_name, j.pickup_address, j.dropoff_address, j.lead_id, j.wx_kind, j.wx_where
  from public.jobs j
  where p_key is not null and length(p_key) >= 32
    and encode(sha256(convert_to(p_key, 'UTF8')), 'hex') = (select key_hash from public.cron_key where id = 1)
    and j.job_date between p_from and p_to and j.status not in ('canceled', 'done')
$$;
revoke execute on function public.weather_jobs(text, date, date) from public;
grant execute on function public.weather_jobs(text, date, date) to anon, authenticated;

-- Remember the weather we last told people about for a job.
create or replace function public.set_job_wx(p_key text, p_job uuid, p_kind text, p_where text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_key is null or length(p_key) < 32
     or encode(sha256(convert_to(p_key, 'UTF8')), 'hex') is distinct from (select key_hash from public.cron_key where id = 1) then
    raise exception 'not allowed';
  end if;
  update public.jobs set wx_kind = p_kind, wx_where = p_where where id = p_job;
end
$$;
revoke execute on function public.set_job_wx(text, uuid, text, text) from public;
grant execute on function public.set_job_wx(text, uuid, text, text) to anon, authenticated;

-- Phones for specific crew members (the job's lead), for the nightly timer.
create or replace function public.crew_push_targets(p_key text, p_crew uuid[])
returns table (crew_id uuid, endpoint text, p256dh text, auth text) language sql stable security definer set search_path = '' as $$
  select s.crew_id, s.endpoint, s.p256dh, s.auth
  from public.push_subscriptions s
  join public.crew_members c on c.id = s.crew_id and c.active
  where p_key is not null and length(p_key) >= 32
    and encode(sha256(convert_to(p_key, 'UTF8')), 'hex') = (select key_hash from public.cron_key where id = 1)
    and s.crew_id = any (p_crew)
$$;
revoke execute on function public.crew_push_targets(text, uuid[]) from public;
grant execute on function public.crew_push_targets(text, uuid[]) to anon, authenticated;
