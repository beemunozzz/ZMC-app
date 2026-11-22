# ZMC Hub v2: progress log

## Done
- Handoff added to the repo: `CLAUDE.md` (the plan) and `reference/zmc-hub-prototype.html` (the v1 prototype, used as a blueprint).
- Stack confirmed by Brandon: Next.js, Vercel, Supabase.
- Phase 0, part 1: Next.js project created with a "Hello ZMC" page in ZMC colors and fonts, light and dark mode, sized for phones (checked at 360 px wide). It builds with no errors.
- Phase 0, part 2: live on Vercel (Hobby plan, Brandon's account) at https://zmc-app.vercel.app. Vercel publishes the GitHub `main` version automatically.

- Phase 1, part 1 (code): Supabase project `zmc-hub` created (free plan, West US). Its two public settings are in Vercel.
  - Login with email and password (Brandon chose passwords over email codes). First-timers tap "First time? Create your password". "Forgot password" emails a reset link. ☰ menu > Change password.
  - Supabase setting: Authentication > Sign In / Providers > Email > "Confirm email" is OFF, so new crew can log in right after creating a password. Only emails on the crew list can create an account.
  - Crew list with roles: Owner, Crew lead, Mover. Only people on the crew list can log in; the first person to log in becomes the owner.
  - Crew page (owner only, ☰ menu > Crew members): add people, set role, email, phone, turn accounts on or off.
  - Phase 1 tested: Brandon logged in on his phone as Owner. (He created his login before the database setup ran, so he was linked by hand; the setup file now handles that case.)
  - Database setup lives in `supabase/migrations/0001_crew_and_logins.sql` (pasted into Supabase > SQL Editor).

## Next
- Phase 2: jobs and the calendar (week, month, today views, new job form, crew assignment, needs-crew flags).
- Before crew log in: add their emails on the Crew page, and set up a free email sender (Resend) so "Forgot password" emails reach them.

## Known limits
- Supabase's built-in email only sends to people on the Supabase team, and only a few emails an hour. It's only needed for "Forgot password" now. Before crew rely on it, set up a free email sender (Resend) in Supabase > Authentication > SMTP.

## Decisions
- Stack: Next.js + Vercel + Supabase (confirmed).
- Testing phase: Brandon builds and tests in his own accounts (Vercel and Supabase free plans). Everything moves to Zach's accounts once it's tested. Both services support transferring a project.
- Invoices leave out materials, water and extra-item lines (Brandon's decision, from the handoff).

## Open questions
- Before handing over: decide on Vercel Pro (about $20/month; the free plan is for non-business use) or moving to a host whose free plan allows business use.
- For Zach: see section 3 of `CLAUDE.md` (trip charge on invoices, truck miles, truck charge, per-mile rates).
