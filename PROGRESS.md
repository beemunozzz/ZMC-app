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

- Employee files (Payroll → Employees → tap a person). Setup steps 0010 and 0011 applied (Brandon approved 0011). Tested: a non-owner trying to terminate is blocked.
  - Contact info on file: name, phone, email (login), home address, emergency contact, start date, notes. Private info is in the owner-only `crew_pay` table.
  - Pay: current rate, this week / last 4 weeks hours and estimated pay, "Give a raise" (new rate, start date, note) and pay history (`pay_changes`).
  - Employment type: Full-time, Part-time (normal access), On call (sees a job only from the day before to the day after; otherwise a home screen), Leave of absence (home screen only). Enforced in the database (`can_see_job_date` in the jobs rule).
  - Dashboard asks "Is [on-call person] still working tomorrow? Yes / No". No takes them off that job (it then needs crew); they keep their login.
  - Terminate: red button → "Are you sure?" with what will happen → turns off the account, blocks the login and signs out every phone, removes them from upcoming jobs, clocks them out. History is kept. Rehire undoes it.

- Customer invoice link (Nov 27, setup step 0022 applied): invoice screen → **Send to customer** makes a private link (`/i/<code>`) with a ready message: Copy text, Text it, Email it (type the customer's email; opens the phone's Mail app), Open link. Same layout as the estimate: Billed to, Move date, Where, Your crew (hours verified), Your bill (hours × rate, overtime, travel), Total paid/due, NTE, How to pay (Zach's Zelle/Venmo/Cash App/Apple Cash from Prices), signature. Venmo and Cash App "Pay $X" buttons when unpaid. **Save your invoice (PDF)** is a one-page server PDF (`src/lib/invoice-pdf.tsx`), checked one page for paid, unpaid, overtime and old-price invoices. Paid status is live. Old invoices (pre-Dec prices) show the amounts without the rate breakdown. Fixed: Zach changing hours on an invoice now keeps the job's adjusted truck rate, travel and flat price (it used the standard rate before).
  - Later: send emails automatically from the app (needs Resend, free plan; ask before signing up) and save the customer's email on quotes/jobs (part of step 0017).

- Nov 27: **Job profit** box on invoices (owner only): customer pays − each crew member's pay (rate from Payroll × clocked hours, or job hours + drive to/from the shop if they didn't clock in) − our truck (the quote's truck choices, or a one-day round-trip estimate) − materials and water = job profit (green) or loss (red). Before payroll taxes and card fees. Schedule cards: the time on its own line; status and "Our truck"/"Their truck" tags under it; crew-hrs hidden in the narrow computer columns. Job page: the navy header's bottom row shows the crew on the left and "We bring our truck" / "Customer's truck" on the right.

- Nov 27: Quotes: **Estimated job profit** (green) in the owner-only Our side box: left for crew pay and profit − crew pay (movers × the crew's average pay rate from Payroll × job + travel hours). Customer copies (quote link, invoice link, PDFs) are built from separate snapshots and never include profit or our costs.

- Nov 27 (setup step 0023 applied): **Truck reserved.** On our-truck jobs, a "Truck reserved" switch under the job's navy header (Zach or the job's lead; `set_truck_reserved`). Until it's on: the header tag reads "Our truck · not reserved" (orange), Zach's schedule cards show an orange "Reserve truck" tag (crew see just "Our truck"), and the schedule summary shows "Trucks to reserve: N". Once on: "Our truck ✓". Profit boxes stay on both quotes (estimate) and invoices (actual), Brandon's call.

- Nov 27: **Crew hours this week** (owner's week schedule, under the days): each full-time crew member's scheduled job hours with a bar out of 40, orange "low" under 30, number of jobs, days off (approved all-day time off); part-time and on-call in one line underneath. Tap a name to see only their jobs. Summary chip "Low on hours: N" jumps to it. Hours are the jobs' estimated hours (no travel). 40/30 are placeholders in `src/components/CrewHours.tsx`; ask Zach what counts as a full week.

- Nov 27 (setup step 0024 applied): **Low-hours alert.** From Wednesday (Pacific) through Sunday, Zach's home screen shows "Low on hours this week" for full-time crew with 16 or fewer scheduled job hours, each with Schedule and **Got it** (hides that person until next week; `hours_alert_acks`). Wednesday evening the nightly timer also sends Zach a phone notification (`low_hours_targets`), once the notification keys are set up. Settings in `src/lib/hours-alert.ts` (16 hrs, Wednesday).
- **Typical crew pay** (☰ → Prices → Our costs, default $20/hr, `owner_costs.crew_pay_rate`): the quote's estimated job profit and the invoice's job profit use it for anyone without a pay rate in Payroll, so the green box always shows. Brandon couldn't see the quote profit box because no crew pay rates are set yet.

- Nov 27: **Swap crew.** Job page (Zach, upcoming jobs): every crew member has **Swap**, and jobs short on crew have **Add someone**. The list shows everyone not on the job with whether they're free that day (time off, regular schedule, other jobs, same check as Edit job) and their hours that week; free people with the fewest hours first; off/busy people greyed out. Swapping out the lead asks who leads now. Both people get a notification ("Today"/"Tomorrow" for last-minute changes); a "can't make it" request is cleared. `src/app/jobs/swap-actions.ts`, `src/lib/swap.ts`, `src/components/CrewSwap.tsx`.
- **Find work** (`/find-work/<person>`): from the low-hours card ("Find work") or a low name in Crew hours: the jobs left this week that person is free for, ones needing crew first, with **Add [name] · +N hrs** and a "Swap in for" list showing each mover's hours this week and after the swap (most hours first, orange when already low) (changing the lead is done on the job page). Not built: trading two people between jobs, drag and drop (Someday).

- Nov 27: **Colors.** Fog is no longer an orange warning (no orange chip or home alert; the job page still shows its tip in grey). New **snow/ice** weather (❄️, orange, with a tip). Orange stays for rain, snow, heat and wind. "Need N more" / open spots / Find work "Needs N" are **red** now (same as no crew). **Month view:** each day shows its jobs as small left-aligned bars under the date, earliest first (light blue, or solid red when that job still needs crew): phones show the time range and last name on two lines ("8:30a–2p" / "Lopez"; a half-hour range wraps instead of being cut off), computers one line ("8:30a–2p Lopez"); phones show 2 (time range and name), and days with 3+ jobs switch to one short line per job (start time) so up to 4 fit; computers show 3 plus "+N more"; the count bubble has the total. Boxes are a little taller; still fixed spots (date top-left, weather top-right, count bottom).

- Nov 27 (setup step 0025 applied): **Weather by stop.** Each job checks its pickup, its drop-off and, on moves 20+ miles apart (straight line, about 25 road miles), halfway along the drive (e.g. Altamont Pass). Schedule cards and Zach's home say where: "Rain in Livermore", "Windy on the drive". The job page lists each stop with its own weather and a tip for each kind of bad weather. **Night-before reminder** adds the weather line. **Weather heads-up:** the nightly timer checks the next 2 days and, when a job's weather turns bad or moves to another stop, notifies Zach and the job's lead once (not the lead for tomorrow's jobs; their reminder has it). It remembers what it told (`jobs.wx_kind`, `wx_where`). Needs the notification keys. Later: match by hour (NWS hourly forecast).

- Nov 27: **Weather days 8–14** from NOAA's free 8–14 day outlook (Climate Prediction Center map service, `outlookAt` in `src/lib/weather.ts`). Shown quietly, never orange: a faded 🌦️ on week/month days that lean wetter than usual, a grey "🌦️ Rain possible · outlook" chip on job cards (names the city when pickup and drop-off differ), and a grey "8–14 day outlook (rough)" note on the job page (wetter/drier and warmer/cooler than usual, with the % chance). Days 1–7 still use the National Weather Service forecast, which replaces the outlook as the day gets closer. Tested against NOAA's live data (Dec 4–10 window: Stockton 40% wetter, 40% cooler).
- Ideas saved for later (Brandon, Nov 27): traffic-aware drive times by time of day with Google (Routes API with a departure time) once Zach's Google Maps account is set up; quotes then compare start times ("Start at 9 AM: about $X · at 12 PM: about $Y, afternoon traffic") and can suggest the cheaper start time to the customer; learn load and unload times by house type, beds, stories, stairs and apartment from real jobs (crew lead taps Arrived → Loaded, leaving → Arrived at drop-off → Done), with a starting table Zach fills in, so quotes predict hours and when each drive happens.
- Decisions: this cloud session now uses a personal environment "ZMC-app" that can also reach NOAA, the weather service and the Census address lookup (for testing weather; the live app on Vercel isn't limited). Node needs NODE_USE_ENV_PROXY=1 to use the proxy in local tests.

- Nov 27: **Dark mode red.** Dark mode uses one red, #EC5B52 (a little lighter than first tried), for red text, chips ("No crew", "open spots", "Need 1 more") and filled shapes (month job bars, count bubbles, red buttons; `bg-bad-fill`). The old soft #F2B8B5 looked pink. Light mode is unchanged (#B3261E).

- Nov 27: **Weather warnings stand out.** Rain, snow, heat and wind now sit in a small orange circle with the same soft shine as the red bubbles (`bg-warn-fill`: light #E07B22, dark #EE8A3A; `src/components/WxIcon.tsx`), on the month view, the week view's day headers and Zach's home strip. The small orange dot (weather at a job site, not Stockton) stays, with a ring so it shows on the circle. The month legend now lists both: "Rain, snow, heat or wind" and "Weather at a job site". "Need N more" tags are solid red too.

- Nov 27: **Hours colors** (full-time crew, scheduled job hours; `hoursBand` in `src/lib/hours-alert.ts`): 🟢 Full 32+, 🟠 Light 20–32, 🔴 Low under 20. Used in Crew hours this week (bar, label and a legend), the job page's Swap list and Find work's "Swap in for" list. Part-time, on-call and owners aren't colored. "Low on hours" chip (under 20) is red. Light and Low names link to Find work. The Wednesday alert still uses 16 hours or fewer.

- Nov 27: **Job header weather.** Next to the date: the day's weather and the low and high during working hours (7 AM to 8 PM) at the pickup city, from the weather service's free hourly forecast (`workTempsAt`, `jobTemps` in `src/lib/weather.ts`), e.g. "Friday, November 27 · ☀️ Partly Sunny · L 44° H 61°". About 6 days ahead; further out it shows just the date (and the 8–14 day outlook note below). Tested with live data.

- Nov 27: **Temperatures on the calendar** (Stockton, 7 AM to 8 PM, from the hourly forecast; `stocktonTemps`): month view on phones shows the high under the weather icon (always the same spot); on computers "L49° H62°" left of the icon. Week view: "L49° H62°" next to the day's weather on computers, stacked under it on phones. About 6 days ahead.

- Nov 27 (setup step 0026 applied): **Weather is kept after the day passes.** The forecast only covers upcoming days, so the app saves the last forecast for today and tomorrow: Stockton's weather and 7 AM–8 PM low/high per day (`weather_days`) and each job's weather by stop plus its low/high (`jobs.wx_saved`). Past days in the week and month views and past jobs (cards and job page) show what it was; past jobs don't show the "bring extra blankets" tips. Saved quietly after the page loads whenever Zach (or Brandon) opens Home, the schedule or a job (`src/lib/weather-saved.ts`); only the daytime forecast is saved, so tonight's forecast never replaces the day's. Tested the rules: Zach can save; the public can't read or change it. Limits: days before today (Nov 27) have nothing saved; a day nobody opens the app keeps the last forecast from the day before. Later: the nightly timer can save it too once the notification keys are set up, and real measured weather (NWS station observations) could replace the forecast.

- Nov 27 (setup step 0027 applied, the CRM set: Brandon picked 1–5 and 8 from the CRM list):
  - **1. Leads board** (☰ → Leads & quotes, `/quotes`): stages New → Contacted → Quoted → Follow up (columns on a computer, stacked on a phone), with Booked and Lost (last 30 days) below. **+ New lead** adds a call or text in seconds. New leads show how long they've waited (orange after 15 min, red after an hour) with **Call** and **Text** buttons that count as the first reply. Lost needs a reason (price, date, another company, no reply, moving themselves, other); the win rate and lost reasons for the last 90 days sit on top. Home's "Needs attention" shows new leads with no reply (red after 15 min).
  - **2. Quote follow-ups:** the customer's estimate link counts opens (not Zach's own when signed in): "👀 Opened 3× · 2 h ago". A follow-up is due 1 day after sending, again 3 days after the first follow-up, and when the estimate expires within 2 days. Home has a **Follow-ups** card and the quote page a follow-up box, each with a ready-to-send text; sending one moves Quoted to Follow up. `src/lib/followups.ts`.
  - Quote form: "Why didn't they book?" when Lost; **Referred by** (a past customer) and **Referral partner** fields (partners list comes with step 4).

  - **3. Customer pages** (☰ → Customers, `/customers`): everyone from quotes, jobs and invoices, matched by phone number (by name when there's no phone). Search, filters (had a move, repeat), paid total, Repeat badge. Each customer: Call/Text, paid, moves, quotes, average rating, how they found ZMC, who referred them, a private note (`customer_notes`), and one history of quotes, jobs and invoices. `src/lib/customers.ts`.
  - **4. Reviews and referrals:** the customer's invoice link asks "How did we do?" (1–5 stars). 4–5 shows Zach's **Google review link** (☰ → Prices → Business → Google review link; empty until Zach adds it); 1–3 asks what went wrong (only Zach sees it) and flags it red on Home for 2 weeks; the rating shows on Zach's invoice page and the customer page. **Referral partners** (☰ → Referral partners): realtors, apartment managers, etc. with leads, booked moves and revenue each; pick the partner on a quote. "Referred by" a past customer: when that quote books, Home reminds Zach to thank them (Text a thank-you if their phone is on file, Mark thanked).
  - **5. Confirmations:** the job page's Text the customer has **7-day** and **2-day confirmation** texts ("Reply YES to confirm") and, once one is sent, **Customer replied YES: mark Confirmed**. Home reminds Zach when each is due (booked jobs only). **Cancellation policy** (☰ → Prices → Business, one sentence up to 120 letters) replaces the "changes can change the estimate" line on the estimate page and PDF. Deposits wait for Square.
  - **8. Estimate accuracy:** the job page has a **Job timeline** for the crew lead and Zach on the day: Arrived → Loaded, leaving → At drop-off → Done (one tap each, undo the last), with minutes between steps. ☰ → **Estimate accuracy** compares estimated hours with real ones (timeline, or the invoice's hours), on target within 30 min, by job type, typical load and unload times by house size, and each job.
  - Fixed: estimate and invoice PDFs could run to 2 pages when both addresses had long house details on a long day with overtime; house details are now one line on the PDF (cut with "…") and spacing is a bit tighter. Checked one page for that worst case, signed and unsigned.

- Nov 27 (setup step 0028 applied): **New hire packet and welcome.**
  - **My info** is now a new hire packet: name and login email shown (name fixed by Zach), **date of birth**, cell phone, home address, emergency contact, driver's license, T-shirt size and **shoe size** (US 6–16, for work boots). No Social Security number. Zach sees birthday and shoe size on the employee's Payroll page. The "Get set up" checklist now counts birthday and shoe size.
  - **Welcome walkthrough** (`/welcome`): the first time a crew member opens the app (not owners), they're sent through 5 steps: Welcome to ZMC Hub, [name]! → About you → Your regular schedule → Add to home screen → Notifications → "You're all set". Each step can be skipped; finishing marks `crew_profile.onboarded_at`, and they land on Home from then on.
  - **Add to home screen** (`src/components/InstallApp.tsx`): Android shows an "Add to home screen" button when Chrome allows it, otherwise the ⋮ menu steps; iPhone shows the three Share → Add to Home Screen → Add steps with the Share icon drawn (Apple doesn't allow a button), and a Safari tip in other browsers; says "✓ on your home screen" when it already is. Always in ☰ → My settings → Add to home screen (My settings also links to My info).
  - **Welcome card** on the crew Home (and the on-call/leave Home): "Welcome to ZMC Hub, [name]!" with what the app does and "Walk me through setup (3 min)", above Get set up, until setup is done. (View as skips the automatic walkthrough, so this is what Brandon sees in previews.)
  - **Birthdays:** "🎂 Demetri's birthday is Sat, Nov 30" on Zach's Home and the crew's Home for the next 7 days ("Happy birthday!" for the person themselves). Month and day only, never the year or age (`upcoming_birthdays`).

- Nov 27: Notifications screen: the one switch is now "Pop-up notifications" with what it means (lock-screen banners like a text, even when the app is closed); on iPhone it shows the Add to home screen steps first. It stays greyed out until the one-time notifications setup (VAPID keys + CRON_SECRET in Vercel, made with ☰ → My settings → Notifications on Zach's/Brandon's login) is done. App Store question answered: it's a web app (PWA); an App Store version is possible later (Capacitor wrapper, Apple $99/yr + Google $25 once, Apple review risk), not needed now.

## Next
- Then: home-screen app icon (needs the logo files), and crew tools (clock in/out, photos).
- Phase 3: address autocomplete (Google Places) and automatic house details (RentCast). Waiting on Brandon: OK to add a card to Google (with a daily cap), OK for RentCast's free plan, and which email to sign up with.
- Before crew log in: add their emails on the Crew page, and set up a free email sender (Resend) so "Forgot password" emails reach them.

- Built (setup step 0012): crew "My time off" (☰ menu): whole days or "can work until" a time. 7+ days ahead is automatic; less is a request Zach approves or denies (the database decides). "Can't make this job?" on the crew's job card and job page goes to Zach as "Needs cover", with a one-tap "Text Zach". Dashboard: "Needs cover" (Find cover / Sorted) and "Time-off requests" (Approve / Deny). The job form's crew picker shows each person as Free / Not available / Only until X / On another job / Asked for time off. Payroll: "Time off coming up". Saving a job without the person who couldn't make it closes their request.

- Phone notifications (setup step 0013) and home-screen install, with a placeholder "ZMC" icon until the real logo arrives (swap the files in `public/icons/`).
  - ☰ → Notifications: Turn on notifications / Send me a test / Turn off. iPhone needs "Add to Home Screen" first (iOS 16.4+); the page walks through it.
  - Zach is notified when someone can't make a job, or asks for time off with less than 7 days' notice. Crew are notified when they're put on a job, taken off one, their job's day or time changes, a job is canceled, or their time off is approved or denied.
  - Needs two Vercel settings: VAPID_PUBLIC_KEY (Config) and VAPID_PRIVATE_KEY (Secret). The owner makes them on the Notifications page (in the browser; nothing is sent anywhere) and pastes them into Vercel, then the app is republished.

- Login and password screens show a big centered "ZMC" with the tape-gold bar (no "Hub").
- ☰ → My settings: Appearance (Automatic / Light / Dark, saved per phone, applied before the page paints so it never flashes), plus links to Notifications, My time off and Change password.

## Planned: crew availability, short-notice job offers, swaps (agreed with Brandon, not built yet)
1. ~~**Not available**~~ (built): crew mark days or times they can't work. 7+ days ahead = automatic; under 7 days = a request Zach approves or denies. Zach's crew picker shows each person as Free / On another job / Not available.
2. **Job offers**: assigning someone to a job within 3 days (72 hours) sends them an offer: Accept / Can't make it, with the estimated finish time. Zach sees Waiting / Accepted / Can't make it. No answer after N minutes (Zach sets it on Payroll; starts at 30) → Zach gets a nudge.
3. **Job changes**: if Zach moves an accepted job (new day or time, more hours), the crew on it are asked to confirm again ("Job moved from Thu 8 AM to Fri 2 PM. Confirm?").
4. **Swaps and cover** (Zach can switch it on or off): crew can request a swap with a coworker (coworker accepts, then Zach approves), or "I need someone to cover" (goes to Zach, who finds someone; available crew can offer to take it).
5. ~~**Notifications**~~ (built, needs the two keys): home-screen app (needs the ZMC logo) plus phone notifications, so offers, answers, swap requests and nudges arrive right away, free. Until then, one-tap texts from Zach's phone with a link to answer. Replying "Confirmed" to a text needs automatic texts (Twilio, paid) later.
6. **Later, with the website booking form (Phase 10)**: customers asking for a move within 72 hours see "Moves within 72 hours need confirmation" and can offer up to 3 dates or times. Zach gets the request, checks who's free, and sends job offers from the app.

- Design skills added to the project (`.claude/skills/`): Impeccable (design rules only; its auto-running program and hooks left out for safety) and Emil Kowalski's web motion skills. The taste skill is held for the zmcmove.com redesign. They load automatically in new Claude Code sessions.

- **Version 1 saved** (commit `4906bbe`, Vercel deployment `dpl_4R8f4Akt81hMoUwhzSCZDp2Z44ao`). See `VERSIONS.md` for how to go back. From here, redesign work goes to the working copy (`claude/new-session-thne14`) and its Vercel preview link only; `main` stays on Version 1 until Brandon approves.

- **Version 2 is live** (Nov 23): the bold redesign with Archivo fonts. Navy band with "Next up" on the dashboard, a navy job ticket with the route line for crew, a navy header on the job page, a calendar-style week, crew initials in circles, one drawn icon set, compact shortcuts. Version 1 is saved (see `VERSIONS.md`).

- Built (setup step 0014): **crew Home** with a "Get set up" checklist (regular schedule, contact + emergency contact, driver's license + shirt size, notifications), next job, next 3 weeks and shortcuts. **My regular schedule**: each day All day / Off by a time / Off (mornings are assumed available). The first one is saved as the **Original**; later changes are requests Zach approves or denies (dashboard + employee page), with the full history kept. The job form's crew picker warns about regular days off and off-by times. **My info**: phone, address, emergency contact, license, shirt size (only them and Zach). Payroll shows "Set up 2/4" per person.

- Built (setup step 0015): Notifications is one on/off switch. Crew also get a **Night-before reminder** switch (around 6 PM, tomorrow's start time and address; Vercel's free daily timer, `vercel.json`), **My jobs in my calendar** on My settings (a private link their iPhone or Google calendar keeps up to date; "Reset link" makes a new one), and **My hours** (this week and last week, hours only) on the crew home.

- Built (setup step 0016): **Meet up**. Every job says where the crew meets: the shop (Zach's house) by default, at a meet time = start − drive from the shop − buffer (Prices page → "Meeting at the shop": shop address + extra minutes, default 10). Drive time: what Zach types on the job, else the job's miles out, else an estimate from the addresses (free map lookup; Google Maps can make it exact later). Crew can tap "I'll meet at the site (own car)" until 8 PM the night before; Zach and the crew lead are notified. Zach (any time) or the crew lead (until the cutoff) can switch everyone to "meet at the job site".

- Built (setup step 0018): **Truck checklist** ("Before you leave") on the crew's job card and the job page. Everyone on the job ticks items as they go on the truck and sees who ticked what; it turns green ("✓ Truck loaded") when done. Zach edits the everyday list on ☰ → Prices → Truck checklist (items ending in "(rain)" only show on rain days) and can add extra items for one job on the job form.

- **Demo data is loaded (Nov 25)** for showing Zach: 20 example jobs, Dylan made a crew lead, and regular schedules for Demetri and Dylan. Everything is listed in `DEMO-DATA.md` with the undo. Say "remove the demo data" to put it back.

- **Crew list (Nov 25):** owners Zach and Brandon; leads Demetri and Dylan; full-time movers Jesus, Juan, Jaime; on call Nate, Emanuel, Anthony. Matt, Bobby and Mark deleted. Zach adds each person's email on ☰ → Crew members so they can create a password.

- Built (setup step 0019): **Developer role** for Brandon (owner access, labelled "Developer") and the **View as** bar at the top of every page (only he sees it): Me · Owner · Lead · Mover · On call, or any person from the list. Previews are read-only (nothing can be saved as someone else). The developer can't be put on jobs: left out of the crew picker, and the database refuses it.

- **Logo:** "ZMC." (with a period) is now set in Georgia (header, login and loading screens).

- Built (setup step 0020): **Dec 2026 pricing** ($75 labor only, $195/$215 all-inclusive, 3-hour minimum, drive-time travel charge, overtime, flat rates side by side) for quotes and invoices, and the owner-only **Our truck cost** panel on quotes (U-Haul rental + gas + pickup time vs what the customer pays for the truck, profit/loss, break-even rate, round trip vs one-way). Our costs live in the owner-only `owner_costs` table (☰ → Prices → Our costs). See `CLAUDE.md` section 3.

- Quotes (Nov 26): **Fill in miles and drive times from Zach's address** button (free map lookup, estimate), and the truck panel's **adjusted hourly rate** (covers our truck + $75, nearest $5) with "Use $X/hr on this quote"; the rate goes to the job and invoice.

- Pricing decision (Nov 26, Brandon): **no profit on the rental truck.** The truck panel's rate is now "with our truck at cost" (labor + truck cost ÷ hours, nearest $5); flat-rate margin is on labor only. Idea for later: flat truck prices by distance band (under 25 mi, under 100 mi) once there's enough history.

- Quotes (Nov 26): **Adjust rate** on the price line; materials and water ($25) are now **our expense** (not charged), shown in the owner-only **Our side** box with what's left for crew pay and profit. Truck at cost now follows the number of movers.

- Built (setup step 0021): **Send to customer.** On a saved quote (with a move date and not-to-exceed), "Create customer link" freezes the customer's numbers and makes a private link (good for 14 days) plus a ready-to-send text (Copy / Text it / Open). The customer's page (`/q/...`) is the approved estimate design: **Save as PDF** (one Letter page), **sign with a finger + name + date**, tick "I accept", **Confirm and book**: the quote turns Booked, the job goes on the schedule with no crew yet, and Zach gets a notification (once notification keys are set up). Our costs and "Our side" are never on it.

## Waiting on Zach: photos, reviews, website booking (setup step 0017)
The database step is written (`supabase/migrations/0017_photos_reviews_booking.sql`) but **not applied yet**. When Zach says go, tell Claude "go ahead" and approve the Supabase prompt within about a minute.

**1. Job photos and damage records**
- What it does: crew and Zach take Before, Damage and After photos on the job page. A damage photo needs a short note, notifies Zach, and crew can't delete it. Only Zach and the crew on that job can see the photos.
- What's involved: a private photo folder in Supabase Storage. Photos are shrunk on the phone before saving.
- Cost: free. The free plan has 1 GB of storage (about 3,000 photos). After that, Supabase's paid plan is about $25/month (check the current price).
- Photos are kept until Zach deletes them.

**2. Google review requests**
- What it does: after a job is marked paid, a one-tap "Ask for a Google review" text opens Messages with a thank-you and Zach's review link. The dashboard lists paid customers who haven't been asked yet.
- Needs from Zach: his Google review link (Google Business Profile → "Ask for reviews" → copy link), saved on ☰ → Prices.
- Cost: free (texts go from the phone's own Messages app).

**3. Website booking form ("Get a free quote")**
- What it does: a public page (zmc-app.vercel.app/book) that customers fill in without logging in: name, phone, email, move date and time of day, addresses, home size, heavy items, notes, how they heard about ZMC. It lands as a **New** quote in the app and notifies Zach. Pianos and hot tubs are flagged.
- Moves within 72 hours: the form says they need Zach's confirmation and asks for up to 3 date/time options.
- What's involved: a "Get a free quote" button on zmcmove.com (Squarespace) linking to the page. Spam guard: hidden bot trap and a limit of 30 requests an hour.
- Cost: free.
- Questions for Zach:
  - OK to put the button on zmcmove.com? Which page(s)?
  - How fast does he want to promise a reply (for example "within 2 hours" or "same day")?
  - Should the form ask for photos of the items? (Possible later; uses the same photo storage.)

## Someday list (fun extras; ask Zach which ones he likes)
Not needed, but they'd make the app feel special. Items marked $ cost money, so ask before turning them on.

**For customers**
- Live "crew on the way" link with a little truck on a map ($, Google Maps).
- Move-day page: date, crew names and photos, the not-to-exceed price, what to expect.
- Photo receipt after the move: before and after photos plus the paid invoice.
- Referral code ("Give $25, get $25"), tracked in the app.

**For Zach**
- Smart hour suggestions learned from past jobs (e.g. "3-bed, 2-story usually takes 5.5 hrs with 3 movers").
- Heat-day warning: suggest an earlier start and extra water on 100°F+ days.
- Busy-day pricing tip ("end of month is full; consider a higher rate or a 3-hour minimum").
- Monthly recap: moves, income, reviews, "best month ever".
- Voice notes on quotes: talk, and the quote fills itself in ($, a few cents each, AI).

**For the crew**
- Badges: "100 moves", "5-star review mention", "zero damage this month".
- Shout-outs on their Home when a review names them.
- Moving-day playlist link on the job card.
- Lift-safety tip of the day on rainy or hot days.

**Behind the scenes**
- Real app icon and splash screen with the ZMC logo (needs the logo files).
- Spanish language option for crew or customers.
- Weekly automatic data backup emailed to Zach (needs the free Resend setup).

## Plan: Best practices (how-to guides for tricky moves). Ask Zach before building.
Brandon's idea: when the crew runs into something hard (and figures it out), it becomes a short guide with photos and steps, so the next crew already knows.
- **Where:** ☰ → Best practices, for everyone. Search box on top; guides sorted by topic (stairs, tight doorways, heavy items, appliances, wrapping and padding, truck loading, safety).
- **A guide:** title, 3–8 numbered steps, a photo for each step (optional), "what to bring", and "don't do this" warnings.
- **Who writes them:** Zach, or crew send a "Here's how we did it" from a job (photos plus a few lines), and Zach approves it before everyone sees it.
- **On jobs:** a job can link the guides that apply (e.g. "Gun safe up stairs"), so they show on the crew's job card.
- **Starter guides** to write with Zach: wrapping a couch, dressers (drawers in or out), TVs, glass and mirrors, appliances (fridge, washer), stairs with a heavy item, tight doorways, truck loading order, lifting safety.
- **Needs:** photo storage (setup step 0017 must be done first). Free.
- **Questions for Zach:** Does he want this? Should crew be able to send in guides, or only him? Any topics to start with?

## Questions for Zach (from Brandon's feature review)
- California overtime (over 8 hrs/day, double over 12) and meal/rest breaks on clock-in and payroll?
- Customer e-signs the not-to-exceed estimate when they book (before the move)?
- Payroll export file for an accountant / QuickBooks? Brandon's question: only for jobs paid by Zelle or card?
- Employee documents (driver's license, W-4, I-9) in the employee file? Goes with the overtime question.
- **Best practices guides** (plan above): does Zach want it, who can add guides, and which topics first?
- Which items on the **Someday list** above does Zach like? (Brandon thinks they're all good.)
- Should crew see their own estimated pay (hours × their rate) on their home screen? Right now they see hours only.
- **Getting paid at the job site:** OK to set up **Square** in Zach's name so crew leads can take cards by tapping on their phone (Tap to Pay, no card reader)? Square charges roughly 2.6% + 15¢ per tap (check current rates). Claude builds and tests it in Square's practice mode first; no real charges until Zach and Brandon say go.
- **Zelle and Venmo** stay as options: the Get paid screen shows Zach's Zelle phone or email and his Zelle QR code, and his Venmo link and QR code. Need from Zach: his Zelle phone or email, his Venmo username, and a screenshot of his Zelle QR code (from his bank app).

## Next to build (Brandon said yes)
- Job photos (before / damage / after), customer photos on quotes.
- Ask for a Google review after an invoice is paid (one-tap text).
- Profit per job (invoice total vs crew pay from hours × rate).
- PDF invoice and receipt to text or email.
- ~~"Depth" look~~: approved and turned on for everyone (`src/app/look-depth.css`; switch off by removing data-look="depth" in `layout.tsx`).

## Today (Brandon, Nov 27): "what do I need to do today"
1. [ ] **Turn on phone notifications for the whole app (once, about 5 min).** Steps are the first item in the list below. Each crew member then turns on their own pop-ups (their Notifications page, or the last step of their welcome walkthrough). Don't paste the keys into the chat.
2. [ ] **App icon with the new logo** (the home-screen icon on iPhone and Android; today's icon still has the old "ZMC" without the period). Either send Claude the logo picture you want, or ask Claude to make one from the "ZMC." Georgia logo on navy. Claude then swaps `public/icons/apple-touch-icon.png` (180×180), `icon-192.png` and `icon-512.png`. After it's live: delete the old icon from your home screen and add the app again so the new one shows.
3. [ ] **Add Zach's payment details** (☰ → Prices → Getting paid: Zelle, Cash App, Venmo, Apple Cash) so they show on invoices and the customer's "How to pay".
4. [ ] **Add Zach's Google review link** (☰ → Prices → Business → Google review link) so 4–5 star customers get it. Zach finds it in Google Business Profile → Ask for reviews.
5. [ ] **Cancellation policy** (☰ → Prices → Business): one short sentence for the estimate, or leave blank.
6. [ ] **Typical crew pay** (☰ → Prices → Our costs, now $20/hr) and each person's real pay rate (Payroll → Employees), so the job profit boxes are exact.
7. [ ] **Try the welcome walkthrough** with one crew member (Demetri or Dylan): add their email on the Crew page, have them sign in, and watch the steps.
8. [ ] Set up **Resend** (free) so "Forgot password" emails reach the crew (see below).

## To do later (Brandon's to-do list: "bring up my to-do list")
- [ ] **Turn on phone notifications (one time, about 5 minutes):**
  1. Logged in as the owner, open the app → ☰ → My settings → Notifications.
  2. Scroll to "One-time setup (owner)" → tap "Make the 3 keys". They're made on your device and sent nowhere.
  3. vercel.com → zmc-app → Settings → Environment Variables: add `VAPID_PUBLIC_KEY` (type Config) and `VAPID_PRIVATE_KEY` (type Secret), copying each value from the app. Keep the app page open until both are saved.
  4. The same box also makes a third key, `CRON_SECRET` (type Secret), for the night-before reminders. Add it too.
  5. Tell Claude "keys added" so it can republish the app.
  6. Turn your own pop-ups on: iPhone: Safari → Share → Add to Home Screen, open ZMC Hub from the home screen → ☰ → My settings → Notifications → flip the "Pop-up notifications" switch → Allow. Android or computer: ☰ → My settings → Notifications → flip the switch → Allow. Then tap "Send me a test". (What you'll see: the switch turns from grey to tappable once the keys are live.)
- [x] Shop address added (Nov 26): 8410 Kelley Dr, Stockton. Meet times use it for jobs without a typed drive time.
- [ ] Add Zach's payment details (☰ → Prices → Getting paid: Zelle, Cash App, Venmo, Apple Cash) so those show as choices on invoices.
- [ ] Send Claude the ZMC logo files (black and white) for the app icon.
- [ ] Set up a free email sender called Resend, so "Forgot password" emails can reach the crew. Supabase's built-in email only sends to Brandon.
- [x] Turn off "Confirm email" in Supabase (done Nov 23). New crew can create a password and log in right away.
- [ ] Decide on a shared ZMC business email (for example a new Gmail) to use for new service sign-ups, so fewer accounts need transferring. See `TRANSFER.md`.
- [ ] Zach: review `WHAT-TO-EXPECT.md` (fix the [bracketed] guesses), publish it on zmcmove.com, then paste the link into ☰ → Prices.
- [ ] Ask Zach the questions in "Questions for Zach" above.

## Known limits
- Supabase's built-in email only sends to people on the Supabase team, and only a few emails an hour. It's only needed for "Forgot password" now. Before crew rely on it, set up a free email sender (Resend) in Supabase > Authentication > SMTP.

## Decisions
- Database steps: Supabase's approval question for steps that include "drop ... if exists" doesn't reach Brandon's screen (times out). Steps that only add things go through. For brand-new tables, leave out the drop lines; otherwise Brandon runs the step in Supabase → SQL Editor.
- Stack: Next.js + Vercel + Supabase (confirmed).
- Testing phase: Brandon builds and tests in his own accounts (Vercel and Supabase free plans). Everything moves to Zach's accounts once it's tested. Both services support transferring a project.
- Invoices leave out materials, water and extra-item lines (Brandon's decision, from the handoff).

## Open questions
- Before handing over: decide on Vercel Pro (about $20/month; the free plan is for non-business use) or moving to a host whose free plan allows business use.
- For Zach: see section 3 of `CLAUDE.md` (trip charge on invoices, truck miles, truck charge, per-mile rates).
