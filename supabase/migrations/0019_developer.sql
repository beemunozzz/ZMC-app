-- ZMC Hub, step 19: the "Developer" flag (Brandon). A developer keeps owner access, is labelled
-- "Developer", and gets the "View as" bar to preview the app as any role or person (read-only).
alter table public.crew_members add column if not exists is_dev boolean not null default false;
-- Applied Nov 25, 2026 with: update public.crew_members set is_dev = true where full_name = 'Brandon Munoz';
