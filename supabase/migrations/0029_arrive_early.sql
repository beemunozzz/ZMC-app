-- ZMC Hub, step 29: everyone arrives at the job a few minutes early (Brandon, Nov 28: 5 minutes before the start time).
-- Shop meet time = start - arrive early - drive - extra minutes before leaving. Applied Nov 28, 2026.
alter table public.settings add column if not exists arrive_early_min int not null default 5 check (arrive_early_min between 0 and 60);
