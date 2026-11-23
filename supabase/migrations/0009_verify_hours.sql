-- ZMC Hub, step 9: the customer verifies the hours; signing is optional; only the owner can change hours afterwards.

-- 1. Signature is now optional.
alter table public.invoices alter column signature drop not null;
alter table public.invoices alter column signed_name drop not null;
alter table public.invoices alter column signed_at drop not null;
alter table public.invoices alter column signed_at drop default;

-- 2. What the customer verified (never changes), and any later change by the owner.
alter table public.invoices add column if not exists hours_verified_at timestamptz;
alter table public.invoices add column if not exists verified_hours numeric(5, 2);
alter table public.invoices add column if not exists verified_movers int;
alter table public.invoices add column if not exists owner_edited_at timestamptz;

-- 3. The lock: after an invoice is saved, crew leads can only record payment (payment method, paid).
--    Only the owner can change hours, movers or charges. What the customer verified can never change.
create or replace function public.invoice_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.hours_verified_at, new.verified_hours, new.verified_movers, new.signature, new.signed_name, new.signed_at, new.job_id, new.created_by)
     is distinct from
     (old.hours_verified_at, old.verified_hours, old.verified_movers, old.signature, old.signed_name, old.signed_at, old.job_id, old.created_by) then
    raise exception 'ZMC: what the customer verified and signed can''t be changed';
  end if;

  if (new.hours, new.movers, new.truck, new.miles_out, new.miles_between, new.miles_back, new.labor, new.trip, new.truck_charge, new.total, new.nte)
     is distinct from
     (old.hours, old.movers, old.truck, old.miles_out, old.miles_between, old.miles_back, old.labor, old.trip, old.truck_charge, old.total, old.nte) then
    if public.my_role() is distinct from 'owner' then
      raise exception 'ZMC: only the owner can change the hours on an invoice';
    end if;
    new.owner_edited_at := now();
  end if;
  return new;
end
$$;
revoke execute on function public.invoice_guard() from public, anon, authenticated;

drop trigger if exists invoice_guard on public.invoices;
create trigger invoice_guard before update on public.invoices
  for each row execute function public.invoice_guard();
