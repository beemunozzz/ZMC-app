import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { AppHeader } from "@/components/AppHeader";
import { NotActive } from "@/components/NotActive";
import { PageLoading } from "@/components/PageLoading";
import { WeatherNote } from "@/components/WeatherNote";
import { WxIcon } from "@/components/WxIcon";
import { roleLabel, requireMember } from "@/lib/crew";
import { DAY_SHORT, ZMC_TZ, addDays, nowMs, minutes as minutesOf, dayOfMonth, fmtDay, fmtDayLong, fmtHours, mondayOf, todayISO } from "@/lib/dates";
import { visibleToCrew } from "@/lib/jobs";
import { JOB_COLUMNS, cityOf, conflicts, isLive, jobCrew, openSpots, timeSpan, type Job } from "@/lib/jobs";
import { money } from "@/lib/pricing";
import { isOpen, type Quote } from "@/lib/quotes";
import { followUpDue, followUpText } from "@/lib/followups";
import { siteUrl } from "@/lib/site-url";
import { FollowUpButton } from "@/app/quotes/FollowUpButton";
import { jobsForecast, stocktonForecast, stocktonTemps } from "@/lib/weather";
import { loadSavedDays, saveWeather } from "@/lib/weather-saved";
import { getClockInEnabled, getPrices } from "@/lib/settings";
import { TIME_COLUMNS, clockTime, type TimeEntry } from "@/lib/time";
import { reminderText } from "@/lib/texts";
import { ReminderLink } from "@/components/ReminderLink";
import { LimitedHome } from "@/components/LimitedHome";
import { setupFor } from "@/lib/setup";
import { ALERT_HOURS, alertDay } from "@/lib/hours-alert";
import { ackLowHours } from "@/app/hours-actions";
import { decideWeek } from "@/app/my-schedule/actions";
import { WEEKDAY_LABEL, WEEKLY_COLUMNS, cleanWeek, currentOf, weekChanges, type WeeklySchedule } from "@/lib/regular";
import { Avatars } from "@/components/Avatars";
import { answerOnCall } from "@/app/payroll/employee-actions";
import { decideTimeOff, resolveCover } from "@/app/availability/actions";
import { COVER_COLUMNS, TIME_OFF_COLUMNS, timeOffText, type CoverRequest, type TimeOff } from "@/lib/availability";
import { WX_EMOJI, WX_LABEL, WX_WATCH, worse, wxChip, type JobWx } from "@/lib/weather-kinds";

export default function HomePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Home />
    </Suspense>
  );
}

type Attention = { key: string; tone: "bad" | "warn"; text: string; sub: string; href: string };

async function Home() {
  const { supabase, me, previewing } = await requireMember();
  if (!me) return <NotActive />;
  if (me.role !== "owner") {
    // On leave: home screen only. On call: home screen unless a job is in their window (day before to day after).
    if (me.employment === "leave") return <LimitedHome me={me} kind="leave" phone={(await getPrices(supabase)).business_phone} setup={await setupFor(supabase, me)} />;
    if (me.employment === "on_call") {
      const { data: rows } = await supabase.from("jobs").select("id, job_date, lead_id, crew_ids").neq("status", "canceled").gte("job_date", addDays(todayISO(), -1));
      const visible = visibleToCrew((rows ?? []) as Pick<Job, "job_date" | "lead_id" | "crew_ids">[], me, todayISO());
      if (!visible.length) return <LimitedHome me={me} kind="on_call" phone={(await getPrices(supabase)).business_phone} setup={await setupFor(supabase, me)} />;
    }
    redirect("/schedule"); // crew home: checklist, next job, coming up, shortcuts
  }

  const today = todayISO();
  const weekStart = mondayOf(today);
  const weekEnd = addDays(weekStart, 6);
  const horizon = addDays(today, 13); // "needs attention" looks two weeks ahead
  const from = weekStart < today ? weekStart : today;

  const [{ data: jobRows }, { data: crewRows }, { data: quoteRows }, stockton] = await Promise.all([
    supabase.from("jobs").select(JOB_COLUMNS).gte("job_date", from).lte("job_date", horizon > weekEnd ? horizon : weekEnd).order("job_date").order("start_time", { nullsFirst: false }),
    supabase.from("crew_members").select("id, full_name, email, user_id, employment, role, is_dev").eq("active", true).order("full_name"),
    supabase.from("quotes").select("id, customer_name, customer_phone, status, created_at, quote_total, move_date, contacted_at, sent_at, accepted_at, followups, last_followup_at, valid_until, share_token, view_count, last_viewed_at").order("created_at", { ascending: false }).limit(300),
    stocktonForecast(),
  ]);
  const jobs = (jobRows ?? []) as Job[];
  const crew = crewRows ?? [];
  const names = new Map(crew.map((c) => [c.id as string, c.full_name as string]));
  const quotes = (quoteRows ?? []) as Pick<Quote, "id" | "customer_name" | "customer_phone" | "status" | "created_at" | "quote_total" | "move_date" | "contacted_at" | "sent_at" | "accepted_at" | "followups" | "last_followup_at" | "valid_until" | "share_token" | "view_count" | "last_viewed_at">[];

  const upcoming = jobs.filter((j) => j.job_date >= today && j.job_date <= horizon && isLive(j));
  const jobWx = await jobsForecast(upcoming, stockton);
  // Keep today's and tomorrow's weather for later, so past days still show it (after the page is sent).
  if (!previewing)
    after(async () => {
      const [temps, saved] = await Promise.all([stocktonTemps(), loadSavedDays(supabase, today, addDays(today, 1))]);
      await saveWeather(supabase, today, { stockton, temps }, saved, jobs, jobWx);
    });

  // ---- Tomorrow's reminders ----
  const tomorrow = addDays(today, 1);
  const tomorrows = jobs.filter((j) => j.job_date === tomorrow && isLive(j));

  // ---- Low hours: full-time crew with ALERT_HOURS or fewer this week (from Wednesday, until Zach taps "Got it") ----
  let lowHours: { id: string; name: string; hours: number; jobs: number }[] = [];
  if (alertDay()) {
    const { data: acks } = await supabase.from("hours_alert_acks").select("crew_id").eq("week_start", weekStart);
    const acked = new Set((acks ?? []).map((a) => a.crew_id as string));
    const weekJobs = jobs.filter((j) => j.job_date >= weekStart && j.job_date <= weekEnd && j.status !== "canceled");
    lowHours = crew
      .filter((c) => c.role !== "owner" && !c.is_dev && (c.employment ?? "full_time") === "full_time" && !acked.has(c.id as string))
      .map((c) => {
        const mine = weekJobs.filter((j) => jobCrew(j).includes(c.id as string));
        return { id: c.id as string, name: c.full_name as string, hours: mine.reduce((s, j) => s + (Number(j.est_hours) || 0), 0), jobs: mine.length };
      })
      .filter((r) => r.hours <= ALERT_HOURS)
      .sort((a, b) => a.hours - b.hours);
  }

  // ---- Crew who can't make a job, and late time-off requests ----
  const [{ data: coverRows }, { data: offRows }] = await Promise.all([
    supabase.from("cover_requests").select(COVER_COLUMNS).eq("status", "open").order("created_at"),
    supabase.from("time_off").select(TIME_OFF_COLUMNS).eq("status", "pending").gte("end_date", today).order("start_date"),
  ]);
  const covers = (coverRows ?? []) as CoverRequest[];
  const coverJobIds = [...new Set(covers.map((c) => c.job_id))];
  const { data: coverJobRows } = coverJobIds.length ? await supabase.from("jobs").select(JOB_COLUMNS).in("id", coverJobIds) : { data: [] };
  const coverJobs = new Map(((coverJobRows ?? []) as Job[]).map((j) => [j.id, j]));
  const lateOff = (offRows ?? []) as TimeOff[];

  // ---- Regular-schedule change requests (with each person's current schedule to compare) ----
  const { data: weekRows } = await supabase.from("weekly_schedules").select(WEEKLY_COLUMNS).in("status", ["pending", "approved"]);
  const allWeeks = (weekRows ?? []) as WeeklySchedule[];
  const weekRequests = allWeeks
    .filter((r) => r.status === "pending")
    .map((r) => {
      const cur = currentOf(allWeeks.filter((o) => o.crew_id === r.crew_id));
      return { r, changes: weekChanges(cur ? cleanWeek(cur.days) : null, cleanWeek(r.days)) };
    });

  // ---- On-call check: "Is this person still working tomorrow?" ----
  const onCallIds = new Set(crew.filter((c) => c.employment === "on_call").map((c) => c.id as string));
  const checkJobs = jobs.filter((j) => (j.job_date === tomorrow || j.job_date === today) && isLive(j) && jobCrew(j).some((id) => onCallIds.has(id)));
  const answered = new Set<string>();
  if (checkJobs.length) {
    const { data } = await supabase.from("oncall_checks").select("job_id, crew_id").in("job_id", checkJobs.map((j) => j.id));
    for (const r of data ?? []) answered.add(`${r.job_id}|${r.crew_id}`);
  }
  const onCallQuestions = checkJobs.flatMap((j) =>
    jobCrew(j)
      .filter((id) => onCallIds.has(id) && !answered.has(`${j.id}|${id}`))
      .map((id) => ({ job: j, crewId: id, name: names.get(id) ?? "Someone" })),
  );
  const prices = await getPrices(supabase);
  const sent = new Set<string>();
  if (tomorrows.length) {
    const { data } = await supabase.from("jobs").select("id, reminder_sent_at").in("id", tomorrows.map((j) => j.id));
    for (const r of (data ?? []) as { id: string; reminder_sent_at: string | null }[]) if (r.reminder_sent_at) sent.add(r.id);
  }
  const remindersLeft = tomorrows.filter((j) => !sent.has(j.id)).length;

  // ---- Who's on the clock (only when clock-in is on) ----
  const clockOn = await getClockInEnabled(supabase);
  const { data: openRows } = clockOn ? await supabase.from("time_entries").select(TIME_COLUMNS).is("clock_out", null) : { data: [] };
  const onClock = (openRows ?? []) as TimeEntry[];

  // ---- Today ----
  const todays = jobs.filter((j) => j.job_date === today && j.status !== "canceled");
  const working = new Set(todays.flatMap(jobCrew));
  const nowMin = minutesOf(
    new Intl.DateTimeFormat("en-GB", { timeZone: ZMC_TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date()),
  )!;
  const liveToday = todays.filter(isLive);
  // Next up: the first job today that hasn't finished yet.
  const nextUp =
    liveToday.find((j) => {
      const st = minutesOf(j.start_time);
      return st == null || st + (Number(j.est_hours) || 2) * 60 > nowMin;
    }) ?? null;
  const laterToday = nextUp ? liveToday.filter((j) => j !== nextUp && liveToday.indexOf(j) > liveToday.indexOf(nextUp)) : [];

  // ---- Needs attention ----
  const attention: Attention[] = [];
  const when = (j: Job) => `${j.job_date === today ? "Today" : fmtDay(j.job_date)} · ${timeSpan(j)}`;
  for (const j of upcoming) {
    const people = jobCrew(j).length;
    if (!people) attention.push({ key: `nc${j.id}`, tone: "bad", text: `No crew: ${j.customer_name}`, sub: when(j), href: `/jobs/${j.id}/edit` });
    else if (openSpots(j) > 0)
      attention.push({ key: `os${j.id}`, tone: "bad", text: `Needs ${openSpots(j)} more: ${j.customer_name}`, sub: when(j), href: `/jobs/${j.id}/edit` });
    const clash = conflicts(j, jobs.filter((o) => o.job_date === j.job_date));
    if (clash.length)
      attention.push({
        key: `db${j.id}`,
        tone: "bad",
        text: `Double-booked: ${names.get(clash[0].crewId) ?? "Someone"} on ${j.customer_name}`,
        sub: when(j),
        href: `/jobs/${j.id}`,
      });
    if (j.nte == null) attention.push({ key: `nte${j.id}`, tone: "warn", text: `No not-to-exceed price: ${j.customer_name}`, sub: when(j), href: `/jobs/${j.id}/edit` });
  }
  // Weather: one line per day, not per job.
  const wxDays = new Map<string, { kind: JobWx["kind"]; jobs: Job[] }>();
  for (const j of upcoming) {
    const w = jobWx.get(j.id);
    if (!w || !WX_WATCH.includes(w.kind)) continue;
    const day = wxDays.get(j.job_date);
    if (day) {
      day.jobs.push(j);
      day.kind = worse({ kind: day.kind }, { kind: w.kind })!.kind;
    } else wxDays.set(j.job_date, { kind: w.kind, jobs: [j] });
  }
  for (const [d, x] of wxDays)
    attention.push({
      key: `wx${d}`,
      tone: "warn",
      text: `${WX_EMOJI[x.kind]} ${x.jobs.length === 1 ? wxChip(jobWx.get(x.jobs[0].id) ?? { kind: x.kind }) : WX_LABEL[x.kind]}: ${x.jobs.length === 1 ? x.jobs[0].customer_name : `${x.jobs.length} jobs`}`,
      sub: d === today ? "Today" : fmtDay(d),
      href: x.jobs.length === 1 ? `/jobs/${x.jobs[0].id}` : `/schedule?view=today&date=${d}`,
    });
  // New leads nobody has replied to yet: red after 15 minutes (the first mover to answer usually wins).
  const nowAt = nowMs();
  const newQuotes = quotes.filter((q) => q.status === "new" && !q.contacted_at);
  for (const q of newQuotes.slice(0, 5)) {
    const mins = Math.round((nowAt - Date.parse(q.created_at)) / 60000);
    const wait = mins < 60 ? `${mins} min` : mins < 2880 ? `${Math.round(mins / 60)} h` : `${Math.round(mins / 1440)} days`;
    attention.push({ key: `q${q.id}`, tone: mins >= 15 ? "bad" : "warn", text: `New lead, no reply yet (${wait}): ${q.customer_name}`, sub: q.move_date ? `Move ${fmtDay(q.move_date)}` : "Tap to call or text", href: "/quotes" });
  }
  if (newQuotes.length > 5)
    attention.push({ key: "qmore", tone: "bad", text: `${newQuotes.length - 5} more new leads waiting`, sub: "Open Leads", href: "/quotes" });
  // Confirmation texts: 7 days out and 2 days out, until the customer confirms.
  for (const j of upcoming) {
    if (j.status !== "booked" || !j.customer_phone) continue;
    const daysOut = Math.round((Date.parse(j.job_date + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) / 86_400_000);
    if (daysOut >= 1 && daysOut <= 2 && !j.confirm2_sent_at)
      attention.push({ key: `c2${j.id}`, tone: "warn", text: `Send the 2-day confirmation: ${j.customer_name}`, sub: when(j), href: `/jobs/${j.id}` });
    else if (daysOut >= 3 && daysOut <= 7 && !j.confirm7_sent_at)
      attention.push({ key: `c7${j.id}`, tone: "warn", text: `Send the 7-day confirmation: ${j.customer_name}`, sub: when(j), href: `/jobs/${j.id}` });
  }
  // Unhappy customers (3 stars or fewer in the last 2 weeks) and referrals to thank.
  const { data: lowRows } = await supabase.from("invoices").select("id, customer_name, rating").lte("rating", 3).gte("rated_at", addDays(today, -14));
  for (const r of (lowRows ?? []) as { id: string; customer_name: string; rating: number }[])
    attention.push({ key: `rate${r.id}`, tone: "bad", text: `${r.rating}-star rating: ${r.customer_name}`, sub: "Reach out to make it right", href: `/invoices/${r.id}` });
  const { data: thankRows } = await supabase.from("quotes").select("id, customer_name, referred_by").eq("status", "booked").neq("referred_by", "").is("referral_thanked_at", null).limit(5);
  for (const r of (thankRows ?? []) as { id: string; customer_name: string; referred_by: string }[])
    attention.push({ key: `ref${r.id}`, tone: "warn", text: `Thank ${r.referred_by} for referring ${r.customer_name}`, sub: "A quick thank-you text goes a long way", href: `/quotes/${r.id}` });
  // Quotes that need a follow-up text today.
  const site = await siteUrl();
  const followUps = quotes
    .map((q) => ({ q, due: followUpDue(q, today) }))
    .filter((x): x is { q: typeof x.q; due: NonNullable<typeof x.due> } => !!x.due && !!x.q.share_token)
    .slice(0, 8);
  attention.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "bad" ? -1 : 1));

  // ---- This week ----
  const week = jobs.filter((j) => j.job_date >= weekStart && j.job_date <= weekEnd && j.status !== "canceled");
  const weekHours = week.reduce((s, j) => s + (Number(j.est_hours) || 0), 0);
  const weekCrewHours = week.reduce((s, j) => s + (Number(j.est_hours) || 0) * jobCrew(j).length, 0);
  const weekStartUtc = new Date(`${weekStart}T08:00:00Z`).toISOString(); // Monday, about midnight in Stockton
  const weekQuotes = quotes.filter((q) => q.created_at >= weekStartUtc);
  const weekBooked = weekQuotes.filter((q) => q.status === "booked").length;
  const openQuoteValue = quotes.filter((q) => isOpen(q.status)).reduce((s, q) => s + (Number(q.quote_total) || 0), 0);

  // ---- Greeting ----
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: ZMC_TZ, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const todayWx = stockton[today];

  const card = "rounded-2xl border border-line bg-card p-4";
  const h2 = "font-display text-lg font-extrabold uppercase text-ink";

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="Home" isOwner name={me.full_name} roleLabel={roleLabel(me)} newJobHref={`/jobs/new?date=${today}`} />

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4">
        {/* Today: the one thing that matters now, on the navy band */}
        <section className="hero -mx-4 -mt-4 flex flex-col gap-4 px-4 pb-6 pt-5 sm:mx-0 sm:mt-0 sm:rounded-3xl sm:px-6">
          <div>
            <h1 className="font-display text-4xl font-extrabold uppercase leading-[0.95] text-ink">
              {hello},<br />
              {me.full_name.split(" ")[0]}
            </h1>
            <p className="mt-2 text-sm tabular-nums text-muted">
              {fmtDayLong(today)}
              {todayWx && (
                <>
                  {" · "}
                  <span aria-hidden>{WX_EMOJI[todayWx.kind]}</span> {todayWx.text || WX_LABEL[todayWx.kind]}
                  {todayWx.hi != null ? `, high ${todayWx.hi}°` : ""}
                </>
              )}
            </p>
          </div>

          {nextUp ? (
            <Link href={`/jobs/${nextUp.id}`} className="press block rounded-2xl border border-line bg-card p-4 transition-colors hover:border-tape/50">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-lg font-extrabold uppercase text-muted">{todays.indexOf(nextUp) === 0 && nowMin < (minutesOf(nextUp.start_time) ?? 0) ? "First job" : "Next up"}</h2>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                    !jobCrew(nextUp).length || openSpots(nextUp) ? "bg-bad/15 text-bad" : "bg-ok/15 text-ok"
                  }`}
                >
                  {jobCrew(nextUp).length}/{nextUp.movers_needed} crew
                </span>
              </div>
              <p className="mt-1 font-display text-5xl font-extrabold tabular-nums leading-none text-tape">{timeSpan(nextUp).split(" – ")[0]}</p>
              <p className="mt-2 break-words text-base font-semibold text-ink">{nextUp.customer_name}</p>
              <p className="break-words text-sm text-muted">
                {[cityOf(nextUp.pickup_address), cityOf(nextUp.dropoff_address)].filter(Boolean).join(" → ") || nextUp.job_type}
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <Avatars people={jobCrew(nextUp).map((id) => ({ id, name: names.get(id) ?? "?" }))} leadId={nextUp.lead_id} />
                <span className="flex items-center gap-1 text-sm font-semibold text-primary">
                  Open <Icon name="chevron" className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ) : (
            <p className="rounded-2xl border border-line bg-card p-4 text-[15px] text-muted">{todays.length ? "That's every job for today." : "No jobs today."}</p>
          )}

          {laterToday.length > 0 && (
            <ul className="flex flex-col gap-1">
              {laterToday.map((j) => (
                <li key={j.id}>
                  <Link href={`/jobs/${j.id}`} className="flex items-center gap-3 rounded-xl px-1 py-1.5 transition-colors hover:bg-bg">
                    <span className="w-16 shrink-0 text-sm font-semibold tabular-nums text-ink">{timeSpan(j).split(" – ")[0]}</span>
                    <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{j.customer_name}</span>
                    <Avatars size="sm" max={3} people={jobCrew(j).map((id) => ({ id, name: names.get(id) ?? "?" }))} leadId={j.lead_id} />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span className="tabular-nums">
              <b className="text-ink">{todays.length}</b> job{todays.length === 1 ? "" : "s"} today
            </span>
            <span className="tabular-nums">
              <b className="text-ink">{working.size}</b> crew working
            </span>
            {clockOn && (
              <span className="tabular-nums">
                <b className="text-ink">{onClock.length}</b> on the clock{onClock.length ? ` (${onClock.map((e) => `${names.get(e.crew_id) ?? "?"} since ${clockTime(e.clock_in)}`).join(", ")})` : ""}
              </span>
            )}
            <Link href="/schedule?view=today" className="ml-auto font-semibold text-primary">
              Full day
            </Link>
          </div>

          {todayWx && WX_WATCH.includes(todayWx.kind) && <WeatherNote wx={{ ...todayWx, atSite: false }} />}
        </section>

        {/* Can't make a job */}
        {covers.length > 0 && (
          <section className="flex flex-col gap-2 rounded-2xl border-2 border-bad/40 bg-card p-4">
            <h2 className={h2}>Needs cover</h2>
            <ul className="divide-y divide-line">
              {covers.map((c) => {
                const j = coverJobs.get(c.job_id);
                return (
                  <li key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                    <p className="min-w-0 flex-1 text-[15px] text-ink">
                      <b>{names.get(c.crew_id) ?? "Someone"}</b> can&apos;t make {j ? <b>{j.customer_name}</b> : "a job"}
                      {c.reason ? <span className="text-muted"> · “{c.reason}”</span> : null}
                      {j && (
                        <span className="block text-xs tabular-nums text-muted">
                          {j.job_date === today ? "Today" : fmtDay(j.job_date)} · {timeSpan(j)}
                        </span>
                      )}
                    </p>
                    <div className="flex shrink-0 gap-2">
                      {j && (
                        <Link href={`/jobs/${j.id}/edit`} className="press flex h-11 items-center rounded-xl bg-bad-fill px-4 font-semibold text-white">
                          Find cover
                        </Link>
                      )}
                      <form action={resolveCover}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="press h-11 rounded-xl border border-line px-3 text-sm font-semibold text-ink">Sorted</button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted">Find cover opens the job: swap them out and save. &ldquo;Sorted&rdquo; clears it if they worked it out.</p>
          </section>
        )}

        {/* Full-time crew low on hours this week */}
        {lowHours.length > 0 && (
          <section className="flex flex-col gap-2 rounded-2xl border-2 border-warn/40 bg-card p-4">
            <h2 className={h2}>Low on hours this week</h2>
            <ul className="divide-y divide-line">
              {lowHours.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-3">
                  <p className="min-w-0 flex-1 text-[15px] text-ink">
                    <b>{r.name}</b>
                    <span className="block text-xs tabular-nums text-muted">
                      {fmtHours(r.hours)} hrs scheduled · {r.jobs} job{r.jobs === 1 ? "" : "s"}
                    </span>
                  </p>
                  <Link href={`/find-work/${r.id}`} className="press flex h-11 shrink-0 items-center rounded-xl border border-line px-3 text-sm font-semibold text-primary">
                    Find work
                  </Link>
                  <form action={ackLowHours}>
                    <input type="hidden" name="crew_id" value={r.id} />
                    <input type="hidden" name="week" value={weekStart} />
                    <button className="press h-11 shrink-0 rounded-xl bg-warn px-3 text-sm font-semibold text-white dark:text-navy">Got it</button>
                  </form>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">Full-time crew with {ALERT_HOURS} hours or fewer on the schedule this week. &ldquo;Got it&rdquo; hides them until next week.</p>
          </section>
        )}

        {/* Late time-off requests */}
        {lateOff.length > 0 && (
          <section className="flex flex-col gap-2 rounded-2xl border-2 border-warn/40 bg-card p-4">
            <h2 className={h2}>Time-off requests</h2>
            <ul className="divide-y divide-line">
              {lateOff.map((r) => (
                <li key={r.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                  <p className="min-w-0 flex-1 text-[15px] text-ink">
                    <b>{names.get(r.crew_id) ?? "Someone"}</b> · {fmtDay(r.start_date)}
                    {r.end_date !== r.start_date ? ` – ${fmtDay(r.end_date)}` : ""}
                    <span className="block text-xs text-muted">
                      {timeOffText(r)}
                      {r.note ? ` · “${r.note}”` : ""} · less than 7 days&apos; notice
                    </span>
                  </p>
                  <form action={decideTimeOff} className="flex shrink-0 gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <button name="answer" value="approve" className="press h-11 w-24 rounded-xl bg-ok font-semibold text-white dark:text-navy">
                      Approve
                    </button>
                    <button name="answer" value="deny" className="press h-11 w-20 rounded-xl border border-bad/50 font-semibold text-bad">
                      Deny
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Regular-schedule change requests */}
        {weekRequests.length > 0 && (
          <section className="flex flex-col gap-2 rounded-2xl border-2 border-warn/40 bg-card p-4">
            <h2 className={h2}>Schedule change requests</h2>
            <ul className="divide-y divide-line">
              {weekRequests.map(({ r, changes }) => (
                <li key={r.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1 text-[15px] text-ink">
                    <p>
                      <b>{names.get(r.crew_id) ?? "Someone"}</b> wants to change their regular schedule
                    </p>
                    <ul className="mt-1 text-sm">
                      {changes.map((c) => (
                        <li key={c.day}>
                          {WEEKDAY_LABEL[c.day]}: <span className="text-muted line-through">{c.before}</span> → <b>{c.after}</b>
                        </li>
                      ))}
                    </ul>
                    {r.note && <p className="text-xs text-muted">&ldquo;{r.note}&rdquo;</p>}
                    <Link href={`/payroll/${r.crew_id}#schedule`} className="text-xs font-semibold text-primary">
                      See their original and history
                    </Link>
                  </div>
                  <form action={decideWeek} className="flex shrink-0 gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <button name="answer" value="approve" className="press h-11 w-24 rounded-xl bg-ok font-semibold text-white dark:text-navy">
                      Approve
                    </button>
                    <button name="answer" value="deny" className="press h-11 w-20 rounded-xl border border-bad/50 font-semibold text-bad">
                      Deny
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* On-call check */}
        {onCallQuestions.length > 0 && (
          <section className="flex flex-col gap-2 rounded-2xl border-2 border-primary/40 bg-card p-4">
            <h2 className={h2}>On-call crew: still working?</h2>
            <ul className="divide-y divide-line">
              {onCallQuestions.map((q) => (
                <li key={`${q.job.id}${q.crewId}`} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                  <p className="min-w-0 flex-1 text-[15px] text-ink">
                    Is <b>{q.name}</b> still working {q.job.job_date === today ? "today" : "tomorrow"}?
                    <span className="block text-xs text-muted">
                      {q.job.customer_name} · {timeSpan(q.job)}
                    </span>
                  </p>
                  <form action={answerOnCall} className="flex shrink-0 gap-2">
                    <input type="hidden" name="job_id" value={q.job.id} />
                    <input type="hidden" name="crew_id" value={q.crewId} />
                    <button name="answer" value="yes" className="press h-11 w-20 rounded-xl bg-ok font-semibold text-white dark:text-navy">
                      Yes
                    </button>
                    <button name="answer" value="no" className="press h-11 w-20 rounded-xl border border-bad/50 font-semibold text-bad">
                      No
                    </button>
                  </form>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">No takes them off that job (it will show as needing crew). They keep their login but only see their home screen.</p>
          </section>
        )}

        {/* Quote follow-ups due today */}
        {followUps.length > 0 && (
          <section className="flex flex-col gap-2 rounded-2xl border-2 border-warn/40 bg-card p-4">
            <h2 className={h2}>Follow-ups</h2>
            <ul className="divide-y divide-line">
              {followUps.map(({ q, due }) => (
                <li key={q.id} className="flex items-center gap-3 py-3">
                  <Link href={`/quotes/${q.id}`} className="min-w-0 flex-1 text-[15px] text-ink">
                    <b>{q.customer_name}</b>
                    <span className="block text-xs tabular-nums text-muted">
                      {due.label}
                      {q.quote_total != null ? ` · ${money(Number(q.quote_total))}` : ""}
                      {q.view_count > 0 ? ` · opened ${q.view_count}×` : " · not opened yet"}
                    </span>
                  </Link>
                  <FollowUpButton id={q.id} phone={q.customer_phone} text={followUpText(q, due.kind, `${site}/q/${q.share_token}`, prices.business_phone)} label="Text" small />
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">Text opens Messages with the follow-up written for you. 1 day after the estimate, again 3 days later, and before it expires.</p>
          </section>
        )}

        {/* Needs attention */}
        <section className={card}>
          <h2 className={h2}>
            Needs attention {attention.length > 0 && <span className="tabular-nums text-muted">({attention.length})</span>}
          </h2>
          {attention.length ? (
            <ul className="mt-2 divide-y divide-line">
              {attention.slice(0, 12).map((a) => (
                <li key={a.key}>
                  <Link href={a.href} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-bg">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${a.tone === "bad" ? "bg-bad-fill" : "bg-warn"}`} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-ink">{a.text}</span>
                      <span className="block truncate text-xs tabular-nums text-muted">{a.sub}</span>
                    </span>
                    <Icon name="chevron" className="h-4 w-4 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 flex items-center gap-1.5 text-[15px] font-medium text-ok">
              <Icon name="check" className="h-4 w-4" /> All clear for the next two weeks.
            </p>
          )}
          {attention.length > 12 && <p className="mt-1 text-sm text-muted">+{attention.length - 12} more on the schedule.</p>}
        </section>

        {/* Tomorrow's reminders */}
        {tomorrows.length > 0 && (
          <section className={card}>
            <h2 className={h2}>
              Tomorrow&apos;s reminders{" "}
              <span className={`tabular-nums ${remindersLeft ? "text-warn" : "text-ok"}`}>
                {remindersLeft ? `(${remindersLeft} to send)` : "✓ all sent"}
              </span>
            </h2>
            <p className="mt-1 text-sm text-muted">Tap to open Messages with the reminder written. Check it, then tap Send.</p>
            <ul className="mt-2 divide-y divide-line">
              {tomorrows.map((j) => (
                <li key={j.id} className="flex items-center gap-3 py-2.5">
                  <Link href={`/jobs/${j.id}`} className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-ink">{j.customer_name}</span>
                    <span className="block truncate text-xs tabular-nums text-muted">{timeSpan(j)}</span>
                  </Link>
                  <div className="w-40 shrink-0">
                    <ReminderLink jobId={j.id} phone={j.customer_phone} body={reminderText(j, prices)} sent={sent.has(j.id)} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Tiles */}
        <nav aria-label="Go to" className="grid grid-cols-4 gap-2">
          <Tile href="/schedule" icon="calendar" label="Schedule" />
          <Tile href={`/jobs/new?date=${today}`} icon="plus" label="New job" primary />
          <Tile href="/quotes" icon="chat" label="Leads" badge={newQuotes.length ? String(newQuotes.length) : undefined} />
          <Tile href="/quotes/new" icon="plus" label="New quote" />
          <Tile href="/team" icon="people" label="Crew" />
          <Tile href="/settings" icon="tag" label="Prices" />
          <Tile href="/invoices" icon="receipt" label="Invoices" />
          <Tile href="/payroll" icon="clock" label="Payroll" />
        </nav>

        {/* Next 7 days */}
        <section className={card}>
          <h2 className={h2}>Next 7 days</h2>
          <div className="mt-3 grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }, (_, i) => addDays(today, i)).map((d) => {
              const list = jobs.filter((j) => j.job_date === d && j.status !== "canceled");
              const short = list.some((j) => isLive(j) && openSpots(j) > 0);
              let w: JobWx | null = stockton[d] ? { ...stockton[d], atSite: false } : null;
              for (const j of list) w = worse(w, jobWx.get(j.id));
              const dow = DAY_SHORT[(new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7];
              return (
                <Link
                  key={d}
                  href={`/schedule?view=today&date=${d}`}
                  aria-label={`${fmtDayLong(d)}: ${list.length} job${list.length === 1 ? "" : "s"}${short ? ", needs crew" : ""}${w ? `, ${WX_LABEL[w.kind]}` : ""}`}
                  className={`press flex min-w-0 flex-col items-center gap-1 rounded-xl border py-2 ${d === today ? "border-tape" : "border-line"}`}
                >
                  <span className="text-[10px] font-semibold uppercase text-muted">{dow}</span>
                  <span className="text-sm font-semibold tabular-nums text-ink">{dayOfMonth(d)}</span>
                  <span className="flex h-6 items-center" aria-hidden>
                    <WxIcon wx={w} size="md" />
                  </span>
                  <span
                    className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold tabular-nums ${
                      !list.length ? "text-muted" : short ? "bg-bad-fill text-white" : "bg-primary text-white dark:text-navy"
                    }`}
                  >
                    {list.length || "–"}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* This week's numbers */}
        <section className={card}>
          <h2 className={h2}>This week</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Jobs" value={String(week.length)} />
            <Stat label="Est. hours" value={fmtHours(weekHours)} sub={`${fmtHours(weekCrewHours)} crew-hrs`} />
            <Stat label="Quotes" value={String(weekQuotes.length)} sub={`${weekBooked} booked`} />
            <Stat label="Open quotes" value={money(openQuoteValue)} sub="new + quoted" />
          </dl>
          <p className="mt-3 text-xs text-muted">Money you&apos;ve invoiced and collected shows here once invoices are built.</p>
        </section>
      </main>
    </div>
  );
}

const ICONS: Record<string, React.ReactNode> = {
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  chat: <path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 17h-8l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 5 5z" />,
  people: (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" />
      <circle cx="16.5" cy="9.5" r="2.3" />
      <path d="M15.5 14.6c2.3-.3 4.3.9 5 3.9" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3.5h12v17l-2.5-1.6L13 20.5l-2.5-1.6L8 20.5l-2-1.3z" />
      <path d="M9 8h6M9 11.5h6M9 15h3.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7.3 7.3a1 1 0 0 1-1.4 0z" />
      <circle cx="8" cy="8" r="1.4" />
    </>
  ),
};

function Tile({ href, icon, label, badge, primary, quiet }: { href: string; icon: keyof typeof ICONS; label: string; badge?: string; primary?: boolean; quiet?: boolean }) {
  // Compact quick action: icon over a short label, four across, so today's work leads the page.
  return (
    <Link
      href={href}
      className={`press relative flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl px-1 text-center ${
        primary ? "bg-primary text-white dark:text-navy" : "border border-line bg-card text-ink"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {ICONS[icon]}
      </svg>
      <span className="text-[13px] font-semibold leading-tight">{label}</span>
      {badge && !quiet && (
        <span className="absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-warn px-1 text-[11px] font-bold text-white dark:text-navy">
          {badge}
        </span>
      )}
    </Link>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-bg p-3">
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-extrabold tabular-nums leading-none text-ink">{value}</dd>
      {sub && <dd className="mt-1 text-xs tabular-nums text-muted">{sub}</dd>}
    </div>
  );
}
