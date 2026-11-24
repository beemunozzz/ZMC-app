-- ZMC Hub, step 17: job photos and damage records, Google review requests, and the website booking form.

-- 1. JOB PHOTOS. Stored in a private bucket; only Zach and the crew on that job can see them.
--    Files are saved as <job id>/<photo id>.jpg.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-photos', 'job-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create or replace function public.uuid_or_null(t text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  return t::uuid;
exception when others then
  return null;
end
$$;

create table if not exists public.job_photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  crew_id uuid references public.crew_members (id) on delete set null,
  kind text not null default 'before' check (kind in ('before', 'damage', 'after')),
  note text not null default '',
  path text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists job_photos_job_idx on public.job_photos (job_id, created_at);
alter table public.job_photos enable row level security;
drop policy if exists "See job photos" on public.job_photos;
create policy "See job photos" on public.job_photos
  for select to authenticated using (public.my_role() = 'owner' or public.is_on_job(job_id));
drop policy if exists "Add job photos" on public.job_photos;
create policy "Add job photos" on public.job_photos
  for insert to authenticated with check (
    public.my_role() = 'owner' or (crew_id = public.my_crew_id() and public.is_on_job(job_id))
  );
drop policy if exists "Remove job photos" on public.job_photos;
create policy "Remove job photos" on public.job_photos
  for delete to authenticated using (public.my_role() = 'owner' or (crew_id = public.my_crew_id() and kind <> 'damage'));
grant select, insert, delete on public.job_photos to authenticated;
revoke all on public.job_photos from anon;

drop policy if exists "ZMC see job photo files" on storage.objects;
create policy "ZMC see job photo files" on storage.objects
  for select to authenticated using (
    bucket_id = 'job-photos'
    and (public.my_role() = 'owner' or public.is_on_job(public.uuid_or_null((storage.foldername(name))[1])))
  );
drop policy if exists "ZMC add job photo files" on storage.objects;
create policy "ZMC add job photo files" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'job-photos'
    and (public.my_role() = 'owner' or public.is_on_job(public.uuid_or_null((storage.foldername(name))[1])))
  );
drop policy if exists "ZMC remove job photo files" on storage.objects;
create policy "ZMC remove job photo files" on storage.objects
  for delete to authenticated using (
    bucket_id = 'job-photos' and (public.my_role() = 'owner' or owner_id = auth.uid()::text)
  );

-- 2. GOOGLE REVIEWS. Zach's review link, and when we last asked each customer.
alter table public.settings add column if not exists review_url text not null default '';
alter table public.invoices add column if not exists review_asked_at timestamptz;

-- 3. WEBSITE BOOKING FORM. Anyone can send a request (no login); it lands as a "New" quote.
alter table public.quotes add column if not exists email text not null default '';
alter table public.quotes add column if not exists source text not null default '';

create or replace function public.submit_booking(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  new_id uuid;
  t text;
  d date;
begin
  -- Basic spam guard: at most 30 website requests an hour.
  if (select count(*) from public.quotes where source = 'website' and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Too many requests right now. Please call or text us.';
  end if;
  if coalesce(trim(p->>'name'), '') = '' or coalesce(trim(p->>'phone'), '') = '' then
    raise exception 'Name and phone are required.';
  end if;
  t := p->>'move_date';
  if t ~ '^\d{4}-\d{2}-\d{2}$' then
    d := t::date;
    if d < (now() at time zone 'America/Los_Angeles')::date or d > (now() at time zone 'America/Los_Angeles')::date + 400 then d := null; end if;
  end if;
  insert into public.quotes (
    status, source, customer_name, customer_phone, email, heard_from, move_date, job_type,
    pickup_address, pickup_house, dropoff_address, dropoff_house, size, heavy_items, notes, truck, movers
  ) values (
    'new', 'website',
    left(trim(p->>'name'), 120), left(trim(p->>'phone'), 40), left(trim(coalesce(p->>'email', '')), 200),
    left(coalesce(p->>'heard_from', ''), 60), d,
    case when p->>'job_type' in ('Full move','Partial move','Garage only','Same property','Storage unit','Pod load/unload','Office move','Labor only')
         then p->>'job_type' else 'Full move' end,
    left(coalesce(p->>'pickup_address', ''), 300),
    jsonb_build_object('type', left(coalesce(p->>'home_type', ''), 30), 'stories', left(coalesce(p->>'stories', ''), 3), 'beds', left(coalesce(p->>'beds', ''), 3)),
    left(coalesce(p->>'dropoff_address', ''), 300), '{}'::jsonb,
    left(coalesce(p->>'size', ''), 120), left(coalesce(p->>'heavy_items', ''), 500), left(coalesce(p->>'notes', ''), 3000),
    case when p->>'truck' = 'theirs' then 'theirs' else 'ours' end, 2
  ) returning id into new_id;
  return new_id;
end
$$;
revoke execute on function public.submit_booking(jsonb) from public;
grant execute on function public.submit_booking(jsonb) to anon, authenticated;

-- Phones to tell Zach about a new website request. Needs the server's secret key (same one as the
-- nightly reminder), so random visitors can't read them.
create or replace function public.owner_push_targets(p_key text)
returns table (endpoint text, p256dh text, auth text) language sql stable security definer set search_path = '' as $$
  select s.endpoint, s.p256dh, s.auth
  from public.push_subscriptions s
  join public.crew_members c on c.id = s.crew_id and c.active and c.role = 'owner'
  where p_key is not null and length(p_key) >= 32
    and encode(sha256(convert_to(p_key, 'UTF8')), 'hex') = (select key_hash from public.cron_key where id = 1)
$$;
revoke execute on function public.owner_push_targets(text) from public;
grant execute on function public.owner_push_targets(text) to anon, authenticated;
