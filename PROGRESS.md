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

- Owner home dashboard (first screen after login, at `/`). The calendar moved to `/schedule`.
  - Greeting with today's date and Stockton weather.
  - Today: today's jobs with crew counts, who's working, and a weather tip on bad-weather days.
  - Needs attention (next 2 weeks): no crew, open spots, double-bookings, missing not-to-exceed price, bad weather (one line per day), quotes waiting on a reply. Red = fix now, orange = check.
  - Big tiles: Schedule, New job, Quotes (with "N new" badge), New quote, Crew, Prices.
  - Next 7 days strip: weather emoji and job count per day (red = needs crew); tap a day to open it.
  - This week: jobs, estimated hours and crew-hours, quotes and how many booked, open quote value. Money totals come with invoices.
  - Crew still land on their "next job" screen (Brandon's choice).
- Navigate buttons open Apple Maps on iPhones and iPads, and Google Maps on Android and computers (detected automatically). "See the house" stays on Google Maps for Street View.

- Customer texts, one-tap (free; Brandon chose this over automatic texts for now). The app writes the text and opens the phone's Messages app with the customer's number; the sender taps Send, so texts come from their own phone.
  - On my way: crew lead (on their next-job card and the job page) or owner picks the drive time (10 min to 1 hr); the text gives the arrival time, rounded up to 5 minutes.
  - Day-before reminder: dashboard "Tomorrow's reminders" list and the job page. Ticks off once tapped (`jobs.reminder_sent_at`).
  - Booking confirmation: offered right after Book it, and on the job page.
  - Texts link to a "What to expect" page when its link is set (☰ → Prices). Draft wording for zmcmove.com is in `WHAT-TO-EXPECT.md`.
  - Database setup: `supabase/migrations/0004_texts.sql`.
  - Later: automatic texts from a ZMC number (Twilio), in Zach's business name, with "OK to text" consent and STOP handling. Exact drive-time ETA needs Google Maps (Phase 3).

- Phase 7: invoices and getting paid.
  - Job page (owner, or that job's crew lead) and the crew lead's next-job card: "Finish job & invoice". After that the button becomes "Get paid · $X", then "✓ Paid".
  - Invoice screen: hours (from the estimate; clock-in later) and movers (from the assigned crew), both editable; truck (ours / theirs) and the three mileage legs. Lines: labor, trip charge, truck miles. No materials, water or extra lines.
  - Not-to-exceed check: can't save if the total is over the NTE (checked on the phone, on the server and in the database). If the job has no NTE, the crew lead types the one the customer was given.
  - Customer types their printed name, signs with a finger, and ticks "I agree… total of $X".
  - Customer picks how they're paying: cash, check, card, plus Zelle, Apple Pay, Cash App and Venmo once Zach's details are on ☰ → Prices → Getting paid.
  - Get paid screen: Cash App / Venmo QR code and button with the amount filled in; Zelle / Apple Cash details with a Copy button; cash, check and card instructions. "Customer wants to pay a different way", "✓ Mark as paid", and "Text the customer a receipt".
  - Invoicing marks the job Done. ☰ → Invoices lists waiting and paid, with totals.
  - Trip charge and truck miles on invoices use the quote rules for now. Still to confirm with Zach (see the open questions in `CLAUDE.md`).
  - Database setup: `supabase/migrations/0005_invoices.sql`.
  - Not built yet: PDF invoice, card payments in the app (Square or Stripe, in Zach's name), Zelle QR picture.

- Supabase and Vercel connectors connected (Brandon signed in at claude.ai). Claude now runs database setup steps directly instead of Brandon pasting SQL.
  - Database setup status: 0001–0006 all applied. 0004 (texts) and 0005 (invoices) were applied by Claude; 0006 locks down helper functions per the Supabase security check.
  - Remaining Supabase security note: "Leaked password protection" is off. It's a Pro-plan feature; fine for now.

- Crew page: tap a person to see a details card (name, email, phone, role, status, hourly pay) with an Edit details button. Hourly pay is stored in an owner-only table (`crew_pay`, setup step 0007) so crew can't see each other's pay.
- On computers, everything clickable shows the pointing-hand cursor; crew rows highlight on hover.

- Crew clock-in with an on/off switch (☰ → Team → Payroll, or the Payroll tile). Starts OFF. Setup step 0008.
  - Off: crew see no clock-in anywhere; invoices use estimated hours.
  - On: crew's Today screen shows a big Clock in / Clock out button (for today's job) and their hours this week. Times come from the server clock; a database rule stops crew from editing times. One open clock-in per person.
  - Payroll page: on/off switch, who's on the clock now (with "Clock out" for forgotten clock-outs), week picker, hours × hourly rate = estimated pay per person and total, and every time entry (Zach can fix or delete one).
  - Invoices: with clock-in on, hours fill in from the crew lead's clock time (rounded up to 15 minutes).
  - Dashboard: "On the clock" line in Today; new Invoices and Payroll tiles.

- Verify hours (setup step 0009): on the invoice screen the customer must tap "✓ I verify these hours" (hours, movers, total shown big). If the hours or movers change after that, they must verify again. Signing is now optional; unsigned invoices say "Customer did not sign."
  - Saved on the invoice: when they verified and exactly what (verified hours and movers). These never change.
  - After saving, only the owner can change hours or charges (invoice page → "Change hours (owner only)"). The invoice and job page then show "Changed by Zach to …" next to what the customer verified. Crew leads can still record payment.
  - Enforced in the database (`invoice_guard` trigger). Tested on the live database with a throwaway invoice: hours change blocked for non-owner, verified hours can't change at all, marking paid still works. The test left nothing behind.

- Employee files (Payroll → Employees → tap a person). Setup steps 0010 (applied) and 0011 (terminate/rehire, needs Brandon's approval in Supabase).
  - Contact info on file: name, phone, email (login), home address, emergency contact, start date, notes. Private info is in the owner-only `crew_pay` table.
  - Pay: current rate, this week / last 4 weeks hours and estimated pay, "Give a raise" (new rate, start date, note) and pay history (`pay_changes`).
  - Employment type: Full-time, Part-time (normal access), On call (sees a job only from the day before to the day after; otherwise a home screen), Leave of absence (home screen only). Enforced in the database (`can_see_job_date` in the jobs rule).
  - Dashboard asks "Is [on-call person] still working tomorrow? Yes / No". No takes them off that job (it then needs crew); they keep their login.
  - Terminate: red button → "Are you sure?" with what will happen → turns off the account, blocks the login and signs out every phone, removes them from upcoming jobs, clocks them out. History is kept. Rehire undoes it.

## Next
- Then: home-screen app icon (needs the logo files), and crew tools (clock in/out, photos).
- Phase 3: address autocomplete (Google Places) and automatic house details (RentCast). Waiting on Brandon: OK to add a card to Google (with a daily cap), OK for RentCast's free plan, and which email to sign up with.
- Before crew log in: add their emails on the Crew page, and set up a free email sender (Resend) so "Forgot password" emails reach them.

## To do later
- [ ] Set up a free email sender called Resend, so "Forgot password" emails can reach the crew. Supabase's built-in email only sends to Brandon.
- [ ] Turn off "Confirm email" in Supabase (Authentication > Sign In / Providers > Email) before crew create passwords, if not done yet.

- [ ] Decide on a shared ZMC business email (for example a new Gmail) to use for new service sign-ups, so fewer accounts need transferring. See `TRANSFER.md`.

- [ ] Zach: review `WHAT-TO-EXPECT.md` (fix the [bracketed] guesses), publish it on zmcmove.com, then paste the link into ☰ → Prices.

## Known limits
- Supabase's built-in email only sends to people on the Supabase team, and only a few emails an hour. It's only needed for "Forgot password" now. Before crew rely on it, set up a free email sender (Resend) in Supabase > Authentication > SMTP.

## Decisions
- Stack: Next.js + Vercel + Supabase (confirmed).
- Testing phase: Brandon builds and tests in his own accounts (Vercel and Supabase free plans). Everything moves to Zach's accounts once it's tested. Both services support transferring a project.
- Invoices leave out materials, water and extra-item lines (Brandon's decision, from the handoff).

## Open questions
- Before handing over: decide on Vercel Pro (about $20/month; the free plan is for non-business use) or moving to a host whose free plan allows business use.
- For Zach: see section 3 of `CLAUDE.md` (trip charge on invoices, truck miles, truck charge, per-mile rates).
