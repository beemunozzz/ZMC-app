-- ZMC Hub, step 22: the customer's invoice link. Same idea as the quote link (step 21): Zach or the lead
-- sends a private link; the customer sees the invoice and can save it as a one-page PDF.
-- Only the customer-safe snapshot is ever shown (never our costs).

alter table public.invoices add column if not exists share_token text unique;
alter table public.invoices add column if not exists customer_view jsonb; -- customer-facing numbers, refreshed when sent or edited
alter table public.invoices add column if not exists sent_at timestamptz;

-- What the public page may read: the snapshot, payment state and the customer's signature. Nothing else.
create or replace function public.public_invoice(p_token text)
returns table (view jsonb, paid_at timestamptz, payment_method text, signed_name text, signature text, signed_at timestamptz, hours_verified_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select i.customer_view, i.paid_at, i.payment_method, i.signed_name, i.signature, i.signed_at, i.hours_verified_at
  from public.invoices i
  where i.share_token = p_token and length(p_token) >= 40 and i.customer_view is not null
$$;
revoke execute on function public.public_invoice(text) from public;
grant execute on function public.public_invoice(text) to anon, authenticated;
