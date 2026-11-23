-- ZMC Hub, step 4: customer texts.
-- Paste this whole file into Supabase > SQL Editor and press Run. Safe to run more than once.

-- Link to the "What to expect" page on zmcmove.com (put in on the Prices page).
alter table public.settings add column if not exists expect_url text not null default '';

-- When the day-before reminder was sent, so the dashboard can tick it off.
alter table public.jobs add column if not exists reminder_sent_at timestamptz;
