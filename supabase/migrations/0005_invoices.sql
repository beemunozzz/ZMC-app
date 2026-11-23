-- ZMC Hub, step 5: invoices and getting paid.
-- Paste this whole file into Supabase > SQL Editor and press Run. Safe to run more than once.

-- 1. Jobs remember their miles (copied from the quote when booked), so the invoice can fill them in.
alter table public.jobs add column if not exists miles_out numeric(6, 1);
alter table public.jobs add column if not exists miles_between numeric(6, 1);
alter table public.jobs add column if not exists miles_back numeric(6, 1);

-- 2. Zach's payment details, shown on the "Get paid" screen. Set on the Prices page.
alter table public.settings add column if not exists zelle text not null default '';
alter table public.settings add column if not exists cashapp text not null default '';
alter table public.settings add column if not exists venmo text not null default '';
alter table public.settings add column if not exists apple_cash text not null default '';

-- 3. Invoices: one per job.
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs (id) on delete cascade,
  customer_name text not null,
  customer_phone text not null default '',
  hours numeric(5, 2) not null,
  movers int not null,
  truck text not null check (truck in ('ours', 'theirs')),
  miles_out numeric(6, 1),
  miles_between numeric(6, 1),
  miles_back numeric(6, 1),
  labor numeric(10, 2) not null,
  trip numeric(10, 2) not null,
  truck_charge numeric(10, 2) not null,
  total numeric(10, 2) not null,
  nte numeric(10, 2) not null,
  signature text not null,
  signed_name text not null,
  signed_at timestamptz not null default now(),
  payment_method text not null check (payment_method in ('cash', 'check', 'zelle', 'card', 'apple_pay', 'cashapp', 'venmo')),
  paid_at timestamptz,
  created_by uuid references public.crew_members (id) on delete set null,
  created_at timestamptz not null default now(),
  check (total <= nte)
);

-- 4. Who is the lead on a job? (used by the rules below)
create or replace function public.is_job_lead(j uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.jobs where id = j and lead_id = public.my_crew_id())
$$;

-- 5. Security rules: the owner sees every invoice. A crew lead can make and see the invoice for a job he leads.
alter table public.invoices enable row level security;

drop policy if exists "See invoices" on public.invoices;
create policy "See invoices" on public.invoices
  for select to authenticated using (public.my_role() = 'owner' or public.is_job_lead(job_id));

drop policy if exists "Make invoices" on public.invoices;
create policy "Make invoices" on public.invoices
  for insert to authenticated with check (public.my_role() = 'owner' or public.is_job_lead(job_id));

drop policy if exists "Mark invoices paid" on public.invoices;
create policy "Mark invoices paid" on public.invoices
  for update to authenticated
  using (public.my_role() = 'owner' or public.is_job_lead(job_id))
  with check (public.my_role() = 'owner' or public.is_job_lead(job_id));

drop policy if exists "Owner deletes invoices" on public.invoices;
create policy "Owner deletes invoices" on public.invoices
  for delete to authenticated using (public.my_role() = 'owner');

grant select, insert, update, delete on public.invoices to authenticated;
revoke all on public.invoices from anon;

-- 6. Once a job is invoiced, mark it Done on the schedule.
create or replace function public.invoice_marks_job_done()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.jobs set status = 'done' where id = new.job_id and status <> 'canceled';
  return new;
end
$$;

drop trigger if exists invoice_done on public.invoices;
create trigger invoice_done after insert on public.invoices
  for each row execute function public.invoice_marks_job_done();
