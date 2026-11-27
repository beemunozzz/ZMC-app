-- ZMC Hub, step 28: the new hire packet (Brandon, Nov 27). Date of birth and shoe size on My info,
-- the first-time "Welcome to ZMC Hub" walkthrough, and birthdays.
alter table public.crew_profile add column if not exists birth_date date;
alter table public.crew_profile add column if not exists shoe_size text not null default '';
alter table public.crew_profile add column if not exists onboarded_at timestamptz;  -- finished the welcome walkthrough

-- Birthdays coming up, for everyone's Home (month and day only, never the year or age).
create or replace function public.upcoming_birthdays(p_days int)
returns table (crew_id uuid, full_name text, month_day text, days_away int)
language sql stable security definer set search_path = '' as $$
  with today as (select (now() at time zone 'America/Los_Angeles')::date as d),
  next_bday as (
    select c.id, c.full_name, p.birth_date,
      (p.birth_date + make_interval(years => (extract(year from t.d) - extract(year from p.birth_date))::int))::date as this_year,
      t.d
    from public.crew_members c
    join public.crew_profile p on p.crew_id = c.id and p.birth_date is not null
    cross join today t
    where c.active and public.my_role() is not null
  )
  select id, full_name, to_char(birth_date, 'MM-DD'),
    (case when this_year < d then (this_year + interval '1 year')::date else this_year end) - d
  from next_bday
  where (case when this_year < d then (this_year + interval '1 year')::date else this_year end) - d between 0 and greatest(0, least(p_days, 60))
  order by 4
$$;
revoke execute on function public.upcoming_birthdays(int) from public, anon;
grant execute on function public.upcoming_birthdays(int) to authenticated;
