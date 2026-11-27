-- ZMC Hub, step 21: the customer's quote link. Zach sends a private link; the customer sees the estimate,
-- can save it as a PDF, sign, and book. Only the customer-safe snapshot is ever shown (never our costs).

alter table public.quotes add column if not exists share_token text unique;
alter table public.quotes add column if not exists customer_view jsonb; -- frozen customer-facing numbers at send time
alter table public.quotes add column if not exists sent_at timestamptz;
alter table public.quotes add column if not exists valid_until date;
alter table public.quotes add column if not exists customer_signature text;
alter table public.quotes add column if not exists customer_signed_name text;
alter table public.quotes add column if not exists accepted_at timestamptz;

-- What the public page may read: the snapshot and the signing state. Nothing else.
create or replace function public.public_quote(p_token text)
returns table (view jsonb, valid_until date, accepted_at timestamptz, signed_name text, signature text, status text)
language sql stable security definer set search_path = '' as $$
  select q.customer_view, q.valid_until, q.accepted_at, q.customer_signed_name, q.customer_signature, q.status
  from public.quotes q
  where q.share_token = p_token and length(p_token) >= 40 and q.customer_view is not null
$$;
revoke execute on function public.public_quote(text) from public;
grant execute on function public.public_quote(text) to anon, authenticated;

-- The customer signs and books: saves the signature, books the quote and puts the job on the schedule
-- (no crew yet, so Zach sees "No crew" and assigns people). Returns 'booked' or a reason it couldn't.
create or replace function public.accept_quote(p_token text, p_signature text, p_name text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  q public.quotes%rowtype;
  today date := (now() at time zone 'America/Los_Angeles')::date;
  new_job uuid;
begin
  select * into q from public.quotes where share_token = p_token and length(p_token) >= 40 for update;
  if not found or q.customer_view is null then return 'not_found'; end if;
  if q.accepted_at is not null or q.job_id is not null then return 'already'; end if;
  if q.status = 'declined' then return 'closed'; end if;
  if q.valid_until is not null and today > q.valid_until then return 'expired'; end if;
  if q.move_date is null or q.move_date < today then return 'date'; end if;
  if coalesce(trim(p_name), '') = '' then return 'name'; end if;
  if p_signature is null or p_signature not like 'data:image/png;base64,%' or length(p_signature) < 1500 or length(p_signature) > 600000 then
    return 'signature';
  end if;

  insert into public.jobs (
    job_date, start_time, est_hours, pickup_address, pickup_house, dropoff_address, dropoff_house,
    customer_name, customer_phone, job_type, truck, status, movers_needed, heavy_items, notes, nte, quote_id,
    miles_out, miles_between, miles_back, drive_min, drive_back_min, flat_price, truck_rate, rate_override
  ) values (
    q.move_date, q.start_time, greatest(coalesce(q.est_hours, 3), 3), q.pickup_address, q.pickup_house, q.dropoff_address, q.dropoff_house,
    q.customer_name, q.customer_phone, q.job_type, q.truck, 'booked', q.movers, q.heavy_items,
    concat_ws(E'\n', case when q.size <> '' then 'Size: ' || q.size end, nullif(q.notes, ''), 'Booked by the customer online (signed estimate).'),
    coalesce(q.nte, (q.customer_view->>'nte')::numeric), q.id,
    q.miles_out, q.miles_between, q.miles_back, q.drive_out_min, q.drive_back_min,
    case when q.pricing = 'flat' then q.flat_price end, q.truck_rate, q.rate_override
  ) returning id into new_job;

  update public.quotes set
    customer_signature = p_signature,
    customer_signed_name = left(trim(p_name), 120),
    accepted_at = now(),
    status = 'booked',
    job_id = new_job
  where id = q.id;
  return 'booked';
end
$$;
revoke execute on function public.accept_quote(text, text, text) from public;
grant execute on function public.accept_quote(text, text, text) to anon, authenticated;

-- Phones to tell Zach (the customer page has no login). Needs the server's secret key (CRON_SECRET).
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
