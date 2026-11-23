-- ZMC Hub, step 13: phone notifications. Each phone that turns notifications on gets one row.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crew_members (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device text not null default '',
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
drop policy if exists "See my phones" on public.push_subscriptions;
create policy "See my phones" on public.push_subscriptions
  for select to authenticated using (crew_id = public.my_crew_id() or public.my_role() = 'owner');
drop policy if exists "Add my phone" on public.push_subscriptions;
create policy "Add my phone" on public.push_subscriptions
  for insert to authenticated with check (crew_id = public.my_crew_id());
drop policy if exists "Remove my phone" on public.push_subscriptions;
create policy "Remove my phone" on public.push_subscriptions
  for delete to authenticated using (crew_id = public.my_crew_id() or public.my_role() = 'owner');
grant select, insert, delete on public.push_subscriptions to authenticated;
revoke all on public.push_subscriptions from anon;

-- Where to send a notification.
--   The owner can notify anyone. Crew can only notify the owner(s) (e.g. "I can't make this job") and themselves (test).
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
    )
$$;
revoke execute on function public.push_targets(uuid[], boolean) from public, anon;
grant execute on function public.push_targets(uuid[], boolean) to authenticated;

-- A phone that no longer accepts notifications (app removed, permission turned off) gets cleaned up.
create or replace function public.drop_push_endpoint(p_endpoint text)
returns void language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and public.my_role() is not null
$$;
revoke execute on function public.drop_push_endpoint(text) from public, anon;
grant execute on function public.drop_push_endpoint(text) to authenticated;
