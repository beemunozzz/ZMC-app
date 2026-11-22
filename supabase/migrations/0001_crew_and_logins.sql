-- ZMC Hub, step 1: the crew list, roles and login rules.
-- Paste this whole file into Supabase > SQL Editor and press Run. Safe to run more than once.

-- 1. The crew list. Each person has a role: owner, lead (crew lead) or mover.
create table if not exists public.crew_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  email text unique check (email = lower(email)),
  full_name text not null,
  phone text,
  role text not null default 'mover' check (role in ('owner', 'lead', 'mover')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. "What is my role?" Used by the security rules below. Inactive people get no role.
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.crew_members
  where user_id = auth.uid() and active
  limit 1
$$;

-- 3. Only people on the crew list can log in.
--    The very first person to log in becomes the owner (that's Brandon while testing).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.crew_members where user_id is not null) then
    insert into public.crew_members (user_id, email, full_name, role)
    values (new.id, lower(new.email), split_part(new.email, '@', 1), 'owner')
    on conflict (email) do update set user_id = excluded.user_id, role = 'owner', active = true;
    return new;
  end if;

  update public.crew_members
     set user_id = new.id
   where email = lower(new.email) and active and user_id is null;

  if not found then
    raise exception 'ZMC: % is not on the crew list', new.email;
  end if;
  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Security rules: everyone on the crew can see the crew list (names and phones of coworkers).
--    Only the owner can add, change or remove people.
alter table public.crew_members enable row level security;

drop policy if exists "Crew can see the crew list" on public.crew_members;
create policy "Crew can see the crew list" on public.crew_members
  for select to authenticated using (public.my_role() is not null);

drop policy if exists "Owner adds crew" on public.crew_members;
create policy "Owner adds crew" on public.crew_members
  for insert to authenticated with check (public.my_role() = 'owner');

drop policy if exists "Owner edits crew" on public.crew_members;
create policy "Owner edits crew" on public.crew_members
  for update to authenticated
  using (public.my_role() = 'owner') with check (public.my_role() = 'owner');

drop policy if exists "Owner removes crew" on public.crew_members;
create policy "Owner removes crew" on public.crew_members
  for delete to authenticated using (public.my_role() = 'owner');

grant select, insert, update, delete on public.crew_members to authenticated;
revoke all on public.crew_members from anon;

-- 5. Starting crew (no emails yet; add each person's email on the Crew page so they can log in).
insert into public.crew_members (full_name, role)
select v.full_name, v.role
from (values
  ('Zach', 'owner'),
  ('Dimitri', 'lead'),
  ('Matt', 'lead'),
  ('Dylan', 'mover'),
  ('Bobby', 'mover'),
  ('Mark', 'mover')
) as v (full_name, role)
where not exists (select 1 from public.crew_members c where c.full_name = v.full_name);

-- 6. If someone created a login before this setup ran, make the earliest login the owner.
insert into public.crew_members (user_id, email, full_name, role)
select u.id, lower(u.email), split_part(u.email, '@', 1), 'owner'
from auth.users u
where not exists (select 1 from public.crew_members where user_id is not null)
order by u.created_at
limit 1
on conflict (email) do update set user_id = excluded.user_id, role = 'owner', active = true;
