# ZMC Hub v2: handoff for Claude Code

This folder is the start of **ZMC Hub version 2**, a real web app for **Zachery's Moving Co. (ZMC)**. Version 1 was a prototype built as a Claude artifact. It worked, but hit hard limits, so we are rebuilding it properly. The prototype is included as `reference/zmc-hub-prototype.html`. Treat it as the blueprint for screens, wording and pricing, not as code to copy.

---

## 1. Who you're working with: read this first

- **Brandon** is building this for his cousin **Zach**, the owner of ZMC. Brandon is an electrician and job-site foreman, and **he has never coded before.**
- Explain every step in plain language. Assume nothing about terminals, Git, hosting or databases.
- Do the coding yourself. When Brandon has to click something (create an account, paste a key, approve a deploy), give him short numbered steps and tell him what he should see when it worked.
- **Ask before anything that costs money**, signs up for a paid plan, or can't be undone (deleting data, sending real texts or charges).
- Never ask Brandon to paste passwords or secret keys into the chat. Have him put keys in the `.env.local` file or the hosting dashboard's environment settings himself.
- Build in small steps. After each step, get it running so Brandon can see it on his phone, then move on.
- Keep a running `PROGRESS.md` with what's done, what's next, and any decisions made.

---

## 2. The business

| | |
|---|---|
| Company | Zachery's Moving Co. (ZMC) |
| Base | Stockton, California (the "shop") |
| Phone | (209) 326-5601 |
| Website | https://www.zmcmove.com (Squarespace) |
| Owner | Zach (also works jobs, sometimes as crew lead) |
| Crew leads | Demetri, Dylan (plus Zach and Brandon as owners) |
| Movers | Full-time: Jesus, Juan, Jaime. On call: Nate, Emanuel, Anthony |

How Zach works today: customers call or text him, he gives a price and a day and time, and he tells the crew their schedule, often at the last minute. The crew is frustrated by that. **They want to see their jobs 2 to 3 weeks ahead, the moment Zach books them.** Zach assigns movers to jobs; movers don't pick their own.

---

## 3. Pricing rules (source of truth, Dec 2026)

All numbers live in **☰ → Prices** (`settings` table; crew can read these, they need them for invoices). The code is `src/lib/pricing.ts`.
- **Labor only** (customer's truck): **$75 per mover per hour**.
- **All-inclusive** (2 movers + our 26' box truck): **$195/hour** local, **$215/hour** when the pickup is **45+ miles** from the shop. Extra movers **$75/hour** each. Gas and mileage included. "Our truck" is always priced as a 26' box truck.
- **3-hour minimum.** The clock runs from arrival at the first address until unloading is done at the last one; the drive between the customer's addresses is on the clock. Quotes default to 2 movers.
- **Travel time** (by drive TIME: shop → first pickup + last drop-off → shop): under 2 h = free; 2 to under 3 h = +1 hour per mover; 3 h+ = half the travel time per mover (all at $75 per mover-hour).
- **Long days** (clock + travel over 8 h): flagged, flat rate suggested. **Overtime:** billed hours past the 8th pay 1.5× on the labor part ($75 → $112.50 per mover).
- **Flat rate:** all day hours (clock + travel) × movers × $75 + $100 per mover on long days, + 15% margin on that labor, + our truck at cost (when we bring it, no margin), rounded up to $10. Hourly and flat are shown side by side; Zach picks.
- **Floor:** labor shouldn't drop below $75 per mover-hour over the whole day. The quote screen shows a note when the hourly price works out under it (e.g. free travel under 2 h); flat rates are built on it.
- **Materials and crew water ($20 + $5) are OUR expense:** not on the customer's estimate, text or invoice. The quote's owner-only **Our side** box shows customer pays − our truck − materials/water = left for crew pay and profit. Flat rates include them at cost.
- **Adjust rate:** on the quote's price line, Zach can type the crew's hourly rate. With our truck it's saved as the truck's share per hour (rate follows the movers); with the customer's truck it's a fixed crew rate. "Back to $X/hr" returns to the standard rate.
- **No pianos and no hot tubs** (refer out; flagged automatically).
- **Not-to-exceed (California):** every quote and job carries one. Suggested = hourly estimate + the cushion hours (setting), or the flat price. **An invoice can't be saved over the NTE.**
- **Our costs (owner only, never shown to crew or customers):** the `owner_costs` table (☰ → Prices → Our costs) and `src/lib/truck-cost.ts`: U-Haul 26' round trip $50.95/day + $1.09/mi + $30/day coverage (est.) + 9% tax + $5 env. fee (est.); one-way = U-Haul's price + coverage + tax + fee + the crew's ride home; gas = miles ÷ 8 MPG × $5.60; $75 truck pickup/return time. The "Our truck cost" panel on quotes compares that with what the customer pays for the truck: (all-inclusive rate − movers × $75) × hours.
- **Truck at cost (no profit on the truck):** the panel shows the all-inclusive rate with our truck at cost: movers × $75 + (rental + gas + $75 pickup/return time) ÷ hours, **rounded to the nearest $5**. "Use $X/hr on this quote" saves **the truck's share per hour** on the quote (`truck_rate`, e.g. $25), so the rate is always movers × $75 + that share and follows the number of movers and hours (2 movers $175, 3 movers $250); it carries to the booked job and the invoice. (`rate_override`, a fixed crew rate, is no longer set.) Flat rates put the margin on labor only; the truck goes in at cost. (Later: flat truck prices by distance band, e.g. under 25 mi or under 100 mi.) **Fill in from Zach's address** (quote screen) estimates miles and drive times from the shop address (straight-line × 1.25 until Google Maps is set up).
- The old rules ($65/hr, 2-hour minimum, 25 free trip miles, $1/mile truck) were replaced in Dec 2026; old quotes and invoices keep their saved totals.

### Open questions for Zach (ask before finalizing invoices)
1. How exactly should the trip or travel charge show on invoices?
2. Do truck miles go on the invoice?
3. What is the truck charge when ZMC provides the truck, compared with when the customer provides it?
4. What is the per-mile charge between pickup and drop-off?
5. Brandon's proposal: one combined mileage fee for shop → pickup → drop-off → back to shop. Confirm the rate.

---

## 4. What v1 (the prototype) does: features to carry over

The live v1 is at https://claude.ai/artifact/Q2dFwB5tcKQMYAj3x2nHGJ. Ask Brandon for screenshots if needed. Its code is in `reference/zmc-hub-prototype.html`.

**One app, two views.** The owner sees the business. A crew member sees only his own jobs.

### Owner side
- **Schedule** with **Week**, **Month** and **Today** views.
  - Week: day columns with job cards showing start time, rough end time, hours, lead and movers. Jobs missing crew are flagged. Weather chips like "Rain likely" are shown in orange.
  - Month: **every day box has fixed spots.** The date is top-left, the weather emoji top-right, and the job count bubble at the bottom. The count turns **red** when any job that day is short on crew. No red box around the day; Brandon tried it and didn't want it. Emojis: ☀️ clear, ☁️ cloudy *and* fog, 🌧️ rain, ❄️ snow/ice, 🔥 hot (100°F+), 💨 wind. Orange warnings: rain, snow, heat, wind (fog is shown quietly). Jobs show as small left-aligned bars under the date, earliest first (blue; red = needs crew; computers add the last name). A small orange dot means the weather is at a job site rather than in Stockton. Everything must fit inside the box on small phones (360 px wide).
  - **Weather for every day** from the Stockton forecast. A day with jobs shows the worst weather that matters for those jobs. Each job has its own forecast, using the worse of its pickup and drop-off cities.
- **Header:** a clean app bar with "ZMC" plus the title, a **+ New job** button, and a **☰ menu**. The menu has a "Show jobs for" crew preview, Business (Quotes, Invoices, Customers, Reports) and Team (Crew members). Brandon disliked buttons "jumbled together".
- **New job form order** (Brandon was specific):
  1. Date and start time
  2. Pickup address, then the house details for it
  3. Drop-off address, then the house details for it
  4. Customer name and phone
  5. Type of job, truck (ours or theirs), status
  6. Estimated hours, movers needed, crew lead and movers
  7. Notes
- **House details per address:** type (House, Condo, Townhouse, Apartment, Mobile home, Duplex), gated (Yes/No), stories, beds, baths, square feet, garage spaces, year built. Show it as a single line like "House · 2 stories · 3 bed · 2.5 bath · 1,878 sq ft · 2-car garage · built 1998". Buttons next to each address: **Zillow** and **See the house** (Google Maps or Street View link).
- **Quotes:**
  - Fields: name, phone, how they heard about ZMC, date and time, type of job, addresses, size, heavy items, notes, truck, movers, hours, miles out, miles between and miles back.
  - **✦ Suggest hours and crew** asks AI using the house details.
  - The price builds itself from the rules above, with a suggested NTE.
  - **Copy text** gives a ready-to-send reply.
  - **Book it** turns the quote into a job.
  - Quote statuses: new, quoted, booked, declined.
- **Customers:** built from jobs and invoices, showing phone, number of jobs, total spent and where they heard about ZMC.
- **Reports:** invoiced this month, paid versus waiting, average job, quote win rate, a 6-month bar chart, and lead sources.
- **Photos** on quotes ("Photos from the customer") and jobs. Booking a quote copies its photos to the job.
- Job types: Full move, Partial move, Garage only, Same property, Storage unit, Pod load/unload, Office move, Labor only.
- Job statuses: Booked, Confirmed, Done, Canceled.

### Crew side
- **Today card:**
  - next job, date and time
  - **Navigate** buttons for pickup and drop-off
  - customer phone, coworkers, weather tip, house details, photos and notes
- **Clock in / Clock out** button, with hours shown in the crew list.
- Crew can **add photos**, for example the front of the house or damage before the move.
- **Crew leads, and the owner when he's on a crew:** **Finish job and invoice**.

### Invoices: new spec, not yet built in v1
- Hours on the job (pre-filled from clock-in time, **editable**) and movers (pre-filled from the assigned crew, **editable**).
- Labor = movers × billed hours (minimum 2) × $65.
- Truck: "We provide the truck" or "Customer provides the truck". If ZMC's truck: a truck charge plus a per-mile charge between pickup and drop-off. The rates are pending Zach's answers.
- **One combined travel/mileage fee** for shop → pickup → drop-off → shop. The rate is pending Zach.
- **No** materials, water or extra-item lines.
- NTE check, which blocks saving if the total is over the NTE.
- **Customer signs on the phone** with a finger signature pad, plus their printed name.
- Customer **picks a payment method:** Cash, Check, Zelle, Card, Apple Pay, Cash App, Venmo.
- **After saving, show a "Get paid" screen** for the chosen method, using Zach's payment info stored in settings:
  - Zelle phone or email, with a copy button and Zach's Zelle QR code
  - Cash App link with the amount filled in, plus a QR code
  - Venmo link, plus a QR code
  - card payment
  - Apple Cash phone number
  - **Mark as paid**
- Send or download a **PDF invoice**, and send it to the customer by text or email.

---

## 5. Why v2: the v1 walls this rebuild must fix

| v1 limit | v2 fix |
|---|---|
| No address dropdown | Google Places Autocomplete |
| House details took 35+ seconds and were unreliable (AI web search; Zillow and Redfin block bots) | **RentCast API** (`/properties` endpoint) called from the server. It returns beds, baths, sq ft, `floorCount`, garage, garage spaces and year built in about 1–2 seconds. Cache every result in the database; repeat addresses are free. The free plan is 50 lookups a month, then $0.20 each. |
| Weather via a scheduled AI task | Call the free **National Weather Service API** (api.weather.gov) from the server on a schedule. |
| Crew needed Claude accounts | Real logins (phone or email magic link) and roles |
| No texts or emails | Twilio or similar, later. Ask before any paid signup. |
| No PDF, no payments | PDF invoices; payment links, QR codes, card payments |
| Hard to transfer ownership | Everything lives in **Zach's** accounts. Brandon is added as a collaborator or developer. |

Don't copy the house photos from Zillow or Google into the app (copyright and terms of use). Link out to them instead.

---

## 6. Suggested stack (confirm with Brandon before starting)

Pick tools that are free to start and easy for a beginner to manage:
- **Next.js** (React), deployed on **Vercel** (free tier)
- **Supabase** for the database, logins and photo storage (free tier)
- **Google Maps Platform** for address autocomplete
- **RentCast** for house details
- **api.weather.gov** for weather
- Later: **Twilio** (texts), **Stripe** or **Square** (card payments), **Resend** (email)
- Make it a **PWA** so it can be added to the phone home screen like an app.
- **Mobile-first.** Most use is on phones.

Use **Zach's** accounts for the domain, database, hosting and APIs where possible. Use something like `app.zmcmove.com` for the address.

---

## 7. Build plan (one phase at a time; demo each phase on Brandon's phone)

0. **Setup.** Accounts, project, first deploy of a "Hello ZMC" page to a live link.
1. **Logins and roles.** Owner, crew lead and mover. Zach invites crew by phone or email. Each crew member sees only his own jobs.
2. **Jobs and calendar.** Week, month and today views, the new job form (order above), crew assignment, and the needs-crew flags.
3. **Address and house details.** Places autocomplete, RentCast lookup on select, caching, and the Zillow and Maps links.
4. **Weather.** NWS forecast for Stockton every day, plus each job's own cities.
5. **Quotes.** The price builder from the rules, the NTE, suggested hours (optional, using the Claude API), copy text, and Book it.
6. **Crew tools.** Today card, Navigate, clock in and out, photos.
7. **Invoices and payments.** The full spec in section 4, the PDF, and the Get paid screen.
8. **Customers and reports.**
9. **Texts and reminders.** Booking confirmation, the day-before reminder, crew schedule texts and review requests. **Ask before turning on any real texting.**
10. **Website quote form** on zmcmove.com that creates a quote in the app.

---

## 8. Design rules

These come from Brandon's feedback and the `zmc-app-design` skill.
- The goal is to "feel like a billion-dollar company app": clean, calm and uncluttered.
- Brand colors from v1 (light / dark):
  - background `#F3F0EA` / `#12171D`
  - ink `#15202B` / `#ECE8E1`
  - primary blue `#1F4E8C` / `#8FB2E6`
  - tape accent `#D9A25B` / `#E0B072`
  - lines `#E2DBD0`
  - red: text `--bad` (`#B3261E` / soft `#F2B8B5` in dark); filled red shapes use `bg-bad-fill` (`#B3261E` / `#D63A31`) with white text, so they never look pink in dark mode
- Fonts: **Archivo** for everything (Brandon's pick, Nov 2026): its narrow width (`.font-display`, wdth 62) for bold uppercase headings, regular width for body. Before that: Barlow Condensed + Inter (Version 1).
- **Logo (Nov 2026, Brandon's pick):** the letters "ZMC." (with the period) in **Georgia**, bold (`.font-logo` in `globals.css`; Gelasio, a free Georgia look-alike, stands in on Android). Used in the header, the login screen and the loading screen. ZMC logo files (black and white) may still come from Zach.
- Motion: subtle and quick, ease-out, animate only transform and opacity, press scale 0.97, and respect "reduce motion".
- Things should sit in **consistent fixed spots**. Brandon notices when layouts shift from one card to the next.
- Use smaller text on phones, an app-style header, and a ☰ menu for secondary screens.
- Support light and dark mode.
- Design skills in `.claude/skills/` (Impeccable and Emil Kowalski's motion skills, text only; see `.claude/skills/README.md`). ZMC's own brand rules win when they disagree.
- The approved "depth" look lives in `src/app/look-depth.css` (soft layered shadows, glass header, glowing main buttons).

---

## 9. Files

- `CLAUDE.md`: this handoff
- `reference/zmc-hub-prototype.html`: the v1 prototype's code, for reference: screens, wording, pricing math. It only loads data inside Claude. To see it working, open the live v1: https://claude.ai/artifact/Q2dFwB5tcKQMYAj3x2nHGJ
- Customer quote link: `src/app/q/[token]/` (public page, approved estimate design), `src/app/quotes/send-actions.ts`, `src/lib/customer-quote.ts` (the customer-safe snapshot: never put our costs in it), `src/lib/quote-pdf.tsx` + `src/app/q/[token]/pdf/route.ts` (the one-page PDF, made on the server with @react-pdf/renderer and the fonts in `src/assets/fonts`).
- Customer invoice link: `src/app/i/[token]/` (public page, same design as the estimate), `src/app/invoices/send-actions.ts`, `src/lib/customer-invoice.ts` (customer-safe snapshot, never our costs), `src/lib/invoice-pdf.tsx` + `src/app/i/[token]/pdf/route.ts`.
- `WEBSITE-HANDOFF.md`: handoff for a separate session about zmcmove.com (Squarespace). The "Get a free quote" page itself is built in this app at `/book`.
