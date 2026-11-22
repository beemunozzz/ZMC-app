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

- Phase 2 (code): jobs and the calendar.
  - Jobs table with security rules: owner sees and edits all jobs; crew leads and movers only see jobs they're on. Setup in `supabase/migrations/0002_jobs.sql`.
  - Schedule with Today / Week / Month tabs, back and forward arrows, and a Today jump.
  - Week: job cards with time, hours, crew count, customer, route, lead and movers, and flags (No crew, Need N more, Double-booked, Their truck).
  - Month: fixed spots in each day box (date top-left, weather spot top-right for Phase 4, job count bottom). The count turns red when a job that day needs crew. Tap a day to open its week.
  - New job / Edit job form in Brandon's order, with house details per address, the "think about a 3rd mover" hint for two-story homes, and the piano / hot tub warning.
  - Job details page with Navigate, Zillow and See the house buttons, crew phones, and Edit job.
  - Crew view: "Your job today / next job" card, plus the next 3 weeks.
  - ☰ menu > Show jobs for: preview what a crew member sees.

- Phase 4 (done early, no account needed): weather from the free National Weather Service.
  - Stockton's forecast for every day (next 7 days, the most NWS gives), saved for an hour.
  - Each job also gets its own forecast: the worse of its pickup and drop-off cities (addresses are turned into map spots with the free US Census lookup, saved for good).
  - Month: emoji in each day's top-right corner; orange dot = weather at a job site, not Stockton. Week: emoji and high next to each date. Job cards: orange chip for rain, heat (100°F+), wind or fog. Crew next-job card and job details: weather line plus a tip.
  - Couldn't test against the live weather service from the build computer; tested the sorting logic with sample forecasts.

- Phase 5: quotes and price settings.
  - ☰ > Prices: every pricing number in one place (rate, minimums, trip charge, truck per mile, materials, water, NTE cushion, business phone), with a live example. Stored in the `settings` table.
  - ☰ > Quotes: list (open first), New quote request, and the quote page.
  - Quote form in Brandon's field order. The price builds itself as you type (labor, trip charge, truck miles, supplies), with a suggested not-to-exceed price (estimate + 1 hour, rounded up to $10), a warning if the NTE is below the estimate, the 3rd-mover hint and the piano / hot tub warning.
  - Copy text: ready-to-send reply (also flips a New quote to Quoted). Book it: makes the job (with the NTE and house details) and links the quote.
  - Jobs now have a not-to-exceed price (job form and job page).
  - Price math tested against every example in the handoff (`priceQuote` in `src/lib/pricing.ts`).
  - Database setup: `supabase/migrations/0003_quotes_and_prices.sql`.
  - Not built yet: "✦ Suggest hours and crew" (needs a paid Claude API key; ask first) and customer photos on quotes (comes with crew photos).

## Next
- Brandon: run `0003_quotes_and_prices.sql` in Supabase, then try a quote and Book it.
- Then: home-screen app icon (needs the logo files), and crew tools (clock in/out, photos).
- Phase 3: address autocomplete (Google Places) and automatic house details (RentCast). Waiting on Brandon: OK to add a card to Google (with a daily cap), OK for RentCast's free plan, and which email to sign up with.
- Before crew log in: add their emails on the Crew page, and set up a free email sender (Resend) so "Forgot password" emails reach them.

## To do later
- [ ] Set up a free email sender called Resend, so "Forgot password" emails can reach the crew. Supabase's built-in email only sends to Brandon.
- [ ] Turn off "Confirm email" in Supabase (Authentication > Sign In / Providers > Email) before crew create passwords, if not done yet.

- [ ] Decide on a shared ZMC business email (for example a new Gmail) to use for new service sign-ups, so fewer accounts need transferring. See `TRANSFER.md`.

## Known limits
- Supabase's built-in email only sends to people on the Supabase team, and only a few emails an hour. It's only needed for "Forgot password" now. Before crew rely on it, set up a free email sender (Resend) in Supabase > Authentication > SMTP.

## Decisions
- Stack: Next.js + Vercel + Supabase (confirmed).
- Testing phase: Brandon builds and tests in his own accounts (Vercel and Supabase free plans). Everything moves to Zach's accounts once it's tested. Both services support transferring a project.
- Invoices leave out materials, water and extra-item lines (Brandon's decision, from the handoff).

## Open questions
- Before handing over: decide on Vercel Pro (about $20/month; the free plan is for non-business use) or moving to a host whose free plan allows business use.
- For Zach: see section 3 of `CLAUDE.md` (trip charge on invoices, truck miles, truck charge, per-mile rates).
