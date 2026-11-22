# Handing ZMC Hub over to Zach

Every account the app uses, what it's for, and how to move it to Zach.
Updated each time a new service is added.

**The big picture:** all the business data (crew, jobs, house details, later quotes and invoices) lives in **one place: Supabase**. Moving Supabase moves all the data. Everything else is either the code (GitHub), the web host (Vercel), or a service the app calls with a key. Those keys just get swapped for Zach's.

## Accounts in use now

| Service | What it does | Holds data? | How it moves to Zach | Time |
|---|---|---|---|---|
| **GitHub** (`ZMC-app`) | Stores the app's code | Code only | Repo **Settings → Transfer ownership** to Zach's GitHub account. History and everything else come along. | 5 min |
| **Vercel** (`zmc-app`) | Puts the app online at the web link | No (just settings) | Project **Settings → Transfer** to Zach's Vercel team. The environment variables come with it. Then connect `app.zmcmove.com`. Decide on the Pro plan ($20/mo) or another host at this point: the free plan is for non-business use. | 10 min |
| **Supabase** (`zmc-hub`) | Database, logins, photos | **Yes: all of it** | Zach makes a Supabase account and organization. Brandon invites Zach into his organization, then **Project Settings → General → Transfer project** to Zach's organization. Data, logins and settings stay exactly as they are. Nothing to export. | 10 min |

## Coming soon (Phase 3)

| Service | What it does | Holds data? | How it moves to Zach | Time |
|---|---|---|---|---|
| **Google Maps Platform** | Address suggestions while typing | No | Zach makes his own Google Cloud project with his card, creates a new key, and pastes it into Vercel in place of Brandon's. Then Brandon deletes his old key. | 15 min |
| **RentCast** | Fills in house details | No (results are saved in Supabase, so they move with it) | Zach makes his own RentCast account, creates a key, and swaps it into Vercel. | 5 min |

## Later phases

- **Resend** (emails), **Twilio** (texts): same as RentCast: Zach's own account, swap the key.
- **Stripe or Square** (card payments): set this up **in Zach's name from the start**, because the money goes to his bank account.

## Hand-over day checklist

1. [ ] Make Zach an **Owner** on the Crew page (add his email), and have him create his password.
2. [ ] Transfer the GitHub repo.
3. [ ] Transfer the Vercel project. Pick a plan. Connect `app.zmcmove.com`.
4. [ ] Transfer the Supabase project.
5. [ ] Swap in Zach's keys for each service listed above, in Vercel → Settings → Environment Variables.
6. [ ] Check the app still works on Zach's phone and Brandon's phone.
7. [ ] Decide what Brandon keeps: a helper login on the Crew page, and "collaborator" access on GitHub, Vercel and Supabase.
