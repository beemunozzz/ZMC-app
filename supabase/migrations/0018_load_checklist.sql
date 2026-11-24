-- ZMC Hub, step 18: the "before you leave" load-up checklist on every job.
-- Zach keeps one list for every job (Prices page). Items marked "(rain)" only show on rain days.
-- He can add extra items for one job. Anyone on the job can tick items off; everyone sees who did.

alter table public.settings add column if not exists load_list text not null default
'Moving blankets
Plastic wrap
Ratchet straps
4-wheel dollies
Hand truck / appliance dolly
Floor runners
Door jamb protectors
Tool bag
Mattress bags
Crew water
Tarps and plastic covers (rain)';

alter table public.jobs add column if not exists load_extra text not null default '';

create table if not exists public.job_checklist (
  job_id uuid not null references public.jobs (id) on delete cascade,
  item text not null check (length(item) between 1 and 80),
  crew_id uuid references public.crew_members (id) on delete set null,
  checked_at timestamptz not null default now(),
  primary key (job_id, item)
);
alter table public.job_checklist enable row level security;
drop policy if exists "See the checklist" on public.job_checklist;
create policy "See the checklist" on public.job_checklist
  for select to authenticated using (public.my_role() = 'owner' or public.is_on_job(job_id));
drop policy if exists "Tick an item" on public.job_checklist;
create policy "Tick an item" on public.job_checklist
  for insert to authenticated with check (
    (public.my_role() = 'owner' or public.is_on_job(job_id)) and crew_id = public.my_crew_id()
  );
drop policy if exists "Untick an item" on public.job_checklist;
create policy "Untick an item" on public.job_checklist
  for delete to authenticated using (public.my_role() = 'owner' or public.is_on_job(job_id));
grant select, insert, delete on public.job_checklist to authenticated;
revoke all on public.job_checklist from anon;
