# Demo data for showing Zach (added Nov 25, 2026)

Brandon asked for realistic example jobs to present the app to Zach, and to be able to **put everything back exactly as it was**. To undo, tell Claude **"remove the demo data"** (or run the SQL below in Supabase → SQL Editor).

## What it was like before (snapshot, Nov 25, 2026)
- Jobs: **1** (Nov 22). Quotes 0, invoices 0, time entries 0, time off 0, regular schedules 0, meet-at-site 0, checklist ticks 0, cover requests 0.
- Crew roles: Zach **owner**, Brandon **owner**, Dimitri **lead**, Dylan **mover**, Matt **mover**, Bobby **mover**, Mark **mover**.
- Shop address: empty.

## What the demo added
- **20 jobs**, Nov 25 to Dec 15: 13 in the next 7 days (several days with 2 or 3 jobs), then 7 scattered over the following weeks. Stockton, Lodi, Manteca, Ripon, Tracy, Lathrop, Mountain House, Galt, Escalon, Modesto, Elk Grove and Sacramento. Start times 8, 8:30, 9, 10 AM, 2 and 3 PM.
  - Customers are made up. **Phone numbers are fake (209) 555-01xx numbers**, so a text button can't reach a real person. Addresses are made-up house numbers on real streets.
  - Leads: Zach, Brandon (both stay **owners**, so Brandon keeps the owner screens), Dimitri and Dylan. Movers: Matt, Bobby, Mark.
  - Three jobs have **two crew leads** (the second lead is listed with the crew; the notes say so): Patterson (Fri Nov 27), Wright (Tue Dec 1), Kim (Sat Dec 5).
  - Examples of flags: Sarah Johnson (Sat Nov 28) needs 1 more mover; Valley Dental Office (Mon Nov 30) has no crew; Emily Davis (Dec 4) mentions a hot tub.
  - Two jobs meet at the site (Thompson garage, Wilson pod); on the Wright job Dylan meets at the site.
- **Dylan's role: mover → crew lead.**
- **Regular schedules** (saved as each person's "Original"): Dimitri off Sundays; Dylan off Mondays and Wednesdays, off by 6 PM Tuesday, Thursday and Friday.

Run **both** undo blocks to get back to the snapshot (1 job, 0 quotes, 0 invoices). Anything done on these jobs during the demo (checklist ticks, meet-up choices, cover requests, invoices, clock-ins) is removed by the undo too.

## Added second (Nov 25): quotes and invoices
- **8 past jobs with invoices** (Nov 4 to Nov 24, marked Done): Hughes, Torres, Ramos, Fields, Wu, Ortega (all **paid**: Zelle, cash, card, Venmo, Zelle, check) and Collins (Cash App), Reed (Zelle) **waiting for payment**. Total invoiced $6,630. Six were signed with a sample signature; two weren't signed. All totals are under the not-to-exceed price and use Zach's real price settings.
- **8 quotes**: 3 new (Bennett; Castillo; Sanchez, who has a piano to refer out), 2 quoted (Walsh, Price), 2 booked and linked to the demo Patterson and Wright jobs (their not-to-exceed prices were matched to the quotes), 1 declined (Alvarez, hot tub, referred out).

### Undo for this part (run with the undo above)
```sql
-- past demo jobs (their invoices go with them)
delete from public.invoices where job_id in (
  'e5241fd7-63e7-405e-a4ca-0f0af62e052c',
  'dfe037da-a44f-498e-a37d-6578ed109bf9',
  'd38a4f70-83b4-4e33-85f8-59227c80bda4',
  '3c70a12f-6202-4562-bc01-a8a7b37fde5e',
  '0a427d98-8ebc-4f51-af94-f506c6eb38a1',
  'df01c512-351b-4591-a9f8-dd8273753ed9',
  '0385c4c4-489f-4354-9452-eb62feb051e1',
  '78d51951-58e0-45d7-bab6-35fe9ade819f'
);
delete from public.jobs where id in (
  'e5241fd7-63e7-405e-a4ca-0f0af62e052c',
  'dfe037da-a44f-498e-a37d-6578ed109bf9',
  'd38a4f70-83b4-4e33-85f8-59227c80bda4',
  '3c70a12f-6202-4562-bc01-a8a7b37fde5e',
  '0a427d98-8ebc-4f51-af94-f506c6eb38a1',
  'df01c512-351b-4591-a9f8-dd8273753ed9',
  '0385c4c4-489f-4354-9452-eb62feb051e1',
  '78d51951-58e0-45d7-bab6-35fe9ade819f'
);
-- demo quotes
delete from public.quotes where id in (
  'd36a0af5-4291-4de7-ae99-921395bff50b',
  '207982c8-40a9-430e-b31e-099d3244aa12',
  'eb46acaf-bdaf-4dfc-8a58-6769d14622ab',
  'fbe75760-21e8-4e2e-8504-b616977be30d',
  '295ffc28-c0c3-49c8-bb8e-0ebf4f938792',
  '69956199-8f88-4378-ac8f-b93a51e0c16c',
  '165e541a-d9a6-4856-be1f-492fd2003c49',
  '02223cfb-86b3-43dd-8604-fd07c634f3c2'
);
```

## Undo (puts it back to the snapshot)
```sql
-- demo job ids
with demo(id) as (select unnest(array[
  'bec73c83-c1ef-42f9-beaf-c57434e1d484',
  '30135ac5-c594-4e84-81ad-ef75f1f3ff3d',
  '99a41894-02cf-4bcd-acb0-42befab54291',
  '889e5d03-166c-4d11-af67-8bd48a34d3be',
  'daf31508-b251-4ce5-ba26-3107f4cfd1e0',
  '60bfaf56-af81-41ce-bbc8-0920f4048664',
  'd693ea0c-dc6d-4150-ad89-582169725e43',
  'b551b047-08f7-4745-bdf0-cb45d7272f3b',
  'ca59670e-39a3-499a-b744-349237a7774d',
  '4630f74f-0b52-47e9-bee2-7ee4a70c6e3b',
  'de1e12df-61ff-4450-a48b-24791c401929',
  '44f91a7e-0d9e-40eb-8f98-fcabe315af77',
  '559907e1-eebc-4203-b964-062f1103e271',
  'a1551558-3469-499e-aa5d-b2ab7482f265',
  '5c076dc4-7b0a-4636-b86e-c193ec877c83',
  '4ceb9137-64b9-47ed-8b7c-41f04d7793bd',
  '86a6fa16-7c2a-4a2b-a17d-063e28f967e4',
  '63e79881-d15d-4949-aa51-76e762d0a088',
  '3500b7db-fdd7-4d4a-9aee-361da45f6c28',
  'bd9ac0fd-acbf-40d7-8664-e53b3e2fe53a'
]::uuid[]))
, a as (delete from public.invoices where job_id in (select id from demo))
, b as (delete from public.time_entries where job_id in (select id from demo))
delete from public.jobs where id in (select id from demo);

-- regular schedules added for the demo (Dimitri and Dylan had none before)
delete from public.weekly_schedules where crew_id in ('7434e403-fbb5-43f4-acdc-bd5d615c3cd3', '22041240-bc0c-425f-995a-e30a562f8139');

-- Dylan back to mover
update public.crew_members set role = 'mover' where id = '22041240-bc0c-425f-995a-e30a562f8139';
```
Deleting a job also removes its meet-at-site choices, checklist ticks, cover requests, photos and on-call checks.
