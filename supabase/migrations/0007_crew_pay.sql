-- ZMC Hub, step 7: crew pay rates. Kept apart from the crew list so only the owner can see them.
create table if not exists public.crew_pay (
  crew_id uuid primary key references public.crew_members (id) on delete cascade,
  hourly_rate numeric(6, 2) check (hourly_rate is null or hourly_rate >= 0),
  updated_at timestamptz not null default now()
);

alter table public.crew_pay enable row level security;
drop policy if exists "Owner manages pay" on public.crew_pay;
create policy "Owner manages pay" on public.crew_pay
  for all to authenticated using (public.my_role() = 'owner') with check (public.my_role() = 'owner');
grant select, insert, update, delete on public.crew_pay to authenticated;
revoke all on public.crew_pay from anon;
