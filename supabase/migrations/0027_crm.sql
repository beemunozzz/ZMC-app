-- ZMC Hub, step 27: the CRM set (Brandon, Nov 27): leads board, quote follow-ups, customer pages,
-- reviews and referrals, confirmations, and estimate accuracy (crew-lead time buttons).

-- 1. LEADS BOARD. Quotes move through stages: new -> contacted -> quoted -> follow_up -> booked / lost.
--    ('declined' is the old word for lost and still works.)
alter table public.quotes drop constraint quotes_status_check;
alter table public.quotes add constraint quotes_status_check
  check (status in ('new', 'contacted', 'quoted', 'follow_up', 'booked', 'lost', 'declined'));
alter table public.quotes add column if not exists contacted_at timestamptz;     -- first reply to the customer
alter table public.quotes add column if not exists lost_reason text not null default '';
alter table public.quotes add column if not exists email text not null default '';
alter table public.quotes add column if not exists source text not null default '';

-- 2. QUOTE FOLLOW-UPS. Link opens (counted by the public page) and follow-up texts sent.
alter table public.quotes add column if not exists view_count int not null default 0;
alter table public.quotes add column if not exists last_viewed_at timestamptz;
alter table public.quotes add column if not exists followups int not null default 0;
alter table public.quotes add column if not exists last_followup_at timestamptz;

create or replace function public.log_quote_view(p_token text)
returns void language sql security definer set search_path = '' as $$
  update public.quotes set view_count = view_count + 1, last_viewed_at = now()
  where share_token = p_token and length(p_token) >= 40
    and (last_viewed_at is null or last_viewed_at < now() - interval '2 minutes'); -- a reload isn't a new look
$$;
revoke execute on function public.log_quote_view(text) from public;
grant execute on function public.log_quote_view(text) to anon, authenticated;

-- 3. CUSTOMER PAGES. One note per customer (by phone number digits). Owner only.
create table if not exists public.customer_notes (
  phone_key text primary key,
  note text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.customer_notes enable row level security;
create policy "Owner manages customer notes" on public.customer_notes
  for all to authenticated using (public.my_role() = 'owner') with check (public.my_role() = 'owner');
grant select, insert, update, delete on public.customer_notes to authenticated;
revoke all on public.customer_notes from anon;

-- 4. REVIEWS AND REFERRALS.
alter table public.settings add column if not exists review_url text not null default '';   -- Zach's Google review link
alter table public.invoices add column if not exists review_asked_at timestamptz;
alter table public.invoices add column if not exists rating int check (rating between 1 and 5);
alter table public.invoices add column if not exists rating_comment text not null default '';
alter table public.invoices add column if not exists rated_at timestamptz;

-- The customer rates the move on their invoice page (no login). Returns 'ok' or a reason.
create or replace function public.rate_invoice(p_token text, p_rating int, p_comment text)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then return 'rating'; end if;
  update public.invoices
    set rating = p_rating, rating_comment = left(coalesce(p_comment, ''), 2000), rated_at = now()
  where share_token = p_token and length(p_token) >= 40;
  if not found then return 'not_found'; end if;
  return 'ok';
end
$$;
revoke execute on function public.rate_invoice(text, int, text) from public;
grant execute on function public.rate_invoice(text, int, text) to anon, authenticated;

-- What the invoice page needs to show the rating and the review link.
create or replace function public.public_invoice_rating(p_token text)
returns table (rating int, rating_comment text, review_url text)
language sql stable security definer set search_path = '' as $$
  select i.rating, i.rating_comment, (select s.review_url from public.settings s where s.id = 1)
  from public.invoices i where i.share_token = p_token and length(p_token) >= 40
$$;
revoke execute on function public.public_invoice_rating(text) from public;
grant execute on function public.public_invoice_rating(text) to anon, authenticated;

-- Referral partners (realtors, apartment managers...) and who referred each quote. Owner only.
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'Realtor',
  phone text not null default '',
  email text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);
alter table public.partners enable row level security;
create policy "Owner manages partners" on public.partners
  for all to authenticated using (public.my_role() = 'owner') with check (public.my_role() = 'owner');
grant select, insert, update, delete on public.partners to authenticated;
revoke all on public.partners from anon;
alter table public.quotes add column if not exists referred_by text not null default '';   -- a customer's name
alter table public.quotes add column if not exists partner_id uuid references public.partners (id) on delete set null;
alter table public.quotes add column if not exists referral_thanked_at timestamptz;

-- 5. CONFIRMATIONS. Confirmation texts sent 7 and 2 days before, and the customer's yes.
alter table public.jobs add column if not exists confirm7_sent_at timestamptz;
alter table public.jobs add column if not exists confirm2_sent_at timestamptz;
alter table public.settings add column if not exists cancellation_policy text not null default '';

-- 8. ESTIMATE ACCURACY. The crew lead taps: Arrived -> Loaded, leaving -> At drop-off -> Done.
alter table public.jobs add column if not exists arrived_at timestamptz;
alter table public.jobs add column if not exists loaded_at timestamptz;
alter table public.jobs add column if not exists at_dropoff_at timestamptz;
alter table public.jobs add column if not exists done_at timestamptz;

create or replace function public.set_job_step(p_job uuid, p_step text, p_on boolean)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if public.my_role() is distinct from 'owner' and not public.is_job_lead(p_job) then return 'not_allowed'; end if;
  if p_step = 'arrived' then update public.jobs set arrived_at = case when p_on then now() end where id = p_job;
  elsif p_step = 'loaded' then update public.jobs set loaded_at = case when p_on then now() end where id = p_job;
  elsif p_step = 'dropoff' then update public.jobs set at_dropoff_at = case when p_on then now() end where id = p_job;
  elsif p_step = 'done' then update public.jobs set done_at = case when p_on then now() end where id = p_job;
  else return 'step';
  end if;
  return 'ok';
end
$$;
revoke execute on function public.set_job_step(uuid, text, boolean) from public, anon;
grant execute on function public.set_job_step(uuid, text, boolean) to authenticated;
