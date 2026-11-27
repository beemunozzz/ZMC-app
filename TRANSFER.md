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

## Notification keys

| Setting (in Vercel) | What it is | On hand-over |
|---|---|---|
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Keys that let the app send phone notifications | They move with the Vercel project. Nothing to do. (If they're ever changed, everyone has to turn notifications on again.) |
| `CRON_SECRET` | Key for the nightly "job tomorrow" reminder timer | Moves with the Vercel project. If it is ever changed, make a new one in the app (Notifications → One-time setup) so the database fingerprint matches. |

## Coming soon (Phase 3)

| Service | What it does | Holds data? | How it moves to Zach | Time |
|---|---|---|---|---|
| **Google Maps Platform** | Address suggestions while typing | No | Zach makes his own Google Cloud project with his card, creates a new key, and pastes it into Vercel in place of Brandon's. Then Brandon deletes his old key. | 15 min |
| **RentCast** | Fills in house details | No (results are saved in Supabase, so they move with it) | Zach makes his own RentCast account, creates a key, and swaps it into Vercel. | 5 min |

## Later phases

- **Resend** (emails), **Twilio** (texts): same as RentCast: Zach's own account, swap the key.
- **Stripe or Square** (card payments): set this up **in Zach's name from the start**, because the money goes to his bank account.

## Monthly costs once ZMC runs on it (checked Nov 27, 2026; prices change, so check the pricing pages first)

| Service | Free plan | Paid plan | Recommendation |
|---|---|---|---|
| **Vercel** (web host) | **Personal, non-business use only.** 100 GB data and 1 million requests a month. | **Pro, $20/month.** Allowed for a business, about 10× the room (1 TB data, 10 million requests), $20 of usage included each month. One person who can deploy is included; adding Brandon as a full member is listed at **another $20/month** (Vercel's pages differ on seats: check). Brandon can instead make changes through GitHub, which needs no seat. | **Required** once the business uses it. Nothing changes in how the app looks or works. |
| **Supabase** (database, logins, photos) | **No backups.** Pauses after a week with no activity (the app stops until someone restores it). | **Pro, about $25/month** (a little more depending on usage; billed per organization). **Daily backups kept 7 days**, never pauses. | **Strongly recommended:** years of customers, jobs and invoices are worth more than $25 a month. |
| **Total** | $0 (not allowed for a business on Vercel) | **About $45/month** | |

Pay-as-you-go later, each asked about before turning on: Google Maps (address suggestions and traffic drive times; Google gives a free amount each month), RentCast house lookups (50 free a month, then $0.20 each), Square card fees, Twilio texts, Resend emails (free plan).

Sources: [Vercel pricing](https://vercel.com/pricing), [Vercel Hobby plan](https://vercel.com/docs/plans/hobby-plan), [Vercel Pro plan](https://vercel.com/docs/plans/pro-plan), [Supabase pricing](https://supabase.com/pricing), [Supabase project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).

## Hand-over day checklist

1. [ ] Make Zach an **Owner** on the Crew page (add his email), and have him create his password.
2. [ ] Transfer the GitHub repo.
3. [ ] Transfer the Vercel project. **Upgrade to Pro ($20/month, in Zach's name and card)**. Connect `app.zmcmove.com`.
4. [ ] Transfer the Supabase project. **Upgrade to Pro (about $25/month, Zach's card)** so daily backups start.
5. [ ] Swap in Zach's keys for each service listed above, in Vercel → Settings → Environment Variables.
6. [ ] Check the app still works on Zach's phone and Brandon's phone.
7. [ ] Decide what Brandon keeps: a helper login on the Crew page, and "collaborator" access on GitHub, Vercel and Supabase. (On Vercel Pro, a full member seat may cost $20/month more; GitHub access alone is free.)
8. [ ] After a day, check Supabase shows a backup (Database → Backups).
