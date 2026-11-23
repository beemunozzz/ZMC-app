# ZMC Hub versions

Saved versions of the app, so we can always go back.

## Version 1: before the design-skills redesign (Brandon likes this one)

- **Saved:** Nov 23, 2026, 8:49 AM
- **Code (GitHub):** commit `4906bbe488707a492a386709078972342c8442b7` on `main`
  ([view it](https://github.com/beemunozzz/ZMC-app/tree/4906bbe488707a492a386709078972342c8442b7))
- **Live copy (Vercel):** deployment `dpl_4R8f4Akt81hMoUwhzSCZDp2Z44ao`
  ([open it](https://zmc-7abw6k3cv-brandon-50f8.vercel.app))
- **What it is:** everything built so far with the approved "depth" look, before any changes from the
  Impeccable, Emil Kowalski motion, or taste skills.

## Version 2 (in progress): refined redesign

- **Where:** Claude's working copy (`claude/new-session-thne14`), on its Vercel preview link.
- **What changed (refinement, same colors and fonts):** one drawn icon set instead of emoji and symbols
  (weather keeps its emoji); headings say what the card is, with no small labels above them; tiles and
  buttons in Inter; cards no longer slide in on every page open; the ☰ menu grows from its button;
  branded text highlight and keyboard focus ring; hover highlights on computers.
- **Status:** waiting on Brandon's yes or no. Not on the live app yet.

## How the redesign works

- **Main version (`main`) = what everyone uses** at https://zmc-app.vercel.app. It stays on Version 1
  while the redesign is being tried.
- **Redesign = Claude's working copy (`claude/new-session-thne14`).** Vercel gives it its own preview
  link. Same data, new look, so the two can be compared side by side.
- If Brandon likes the redesign, it gets copied onto `main` and becomes Version 2.

## How to go back to Version 1

**Easiest (about 30 seconds, no code):**
1. vercel.com → zmc-app → **Deployments**.
2. Find the one from **Nov 23** named "Add design skills: Impeccable (rules only)…" (or open the link above).
3. Tap **⋯** → **Promote to Production** (or **Instant Rollback**). The live app is back to Version 1
   within a minute.

**For good (so new updates start from Version 1):** tell Claude *"revert to Version 1"*. Claude puts
the code back to commit `4906bbe` (with a new save on top, so nothing is lost) and publishes it.

Database changes (new tables or columns) are not undone by going back. They're harmless to Version 1,
which simply doesn't use them.
