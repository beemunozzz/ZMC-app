import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Fragment, Suspense } from "react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { CrewHours, lowHoursCount, weekHours, type CrewForHours } from "@/components/CrewHours";
import { JobCard } from "@/components/JobCard";
import { WxIcon } from "@/components/WxIcon";
import { NextJob } from "@/components/NextJob";
import { NotActive } from "@/components/NotActive";
import { PageLoading } from "@/components/PageLoading";
import { roleLabel, requireMember } from "@/lib/crew";
import {
  DAY_SHORT,
  addDays,
  addMonths,
  dayOfMonth,
  firstOfMonth,
  fmtDayLong,
  fmtHours,
  fmtMonth,
  fmtShort,
  isISODate,
  lastOfMonth,
  minutes,
  mondayOf,
  todayISO,
} from "@/lib/dates";
import { JOB_COLUMNS, conflicts, isLive, jobCrew, needsTruck, openSpots, visibleToCrew, type Job } from "@/lib/jobs";
import { jobsForecast, jobsOutlook, stocktonForecast, stocktonOutlook } from "@/lib/weather";
import { WX_LABEL, outlookWet, worse, type JobOutlook, type JobWx } from "@/lib/weather-kinds";
import { WeatherNote } from "@/components/WeatherNote";
import { ClockCard } from "@/components/ClockCard";
import { CrewShortcuts, SetupChecklist } from "@/components/CrewSetup";
import { setupFor, type SetupItem } from "@/lib/setup";
import { loadMeet } from "@/lib/meet";
import { loadChecklist } from "@/lib/checklist-server";
import type { ChecklistItem } from "@/lib/checklist";
import type { MeetInfo } from "@/components/MeetUp";
import { getClockInEnabled, getPrices } from "@/lib/settings";
import { COVER_COLUMNS, type CoverRequest } from "@/lib/availability";
import { TIME_COLUMNS, entryHours, fmtDuration, weekBounds, type TimeEntry } from "@/lib/time";

type View = "today" | "week" | "month";
type Search = { view?: string; date?: string; who?: string };

export default function SchedulePage({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Schedule searchParams={searchParams} />
    </Suspense>
  );
}

async function Schedule({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const { supabase, me } = await requireMember();
  if (!me) return <NotActive />;

  const isOwner = me.role === "owner";
  if (!isOwner && me.employment === "leave") redirect("/"); // on leave: no schedule
  const onCall = !isOwner && me.employment === "on_call"; // on call: only today's view (their job window)
  const today = todayISO();
  const view: View = onCall ? "today" : sp.view === "month" || sp.view === "today" || sp.view === "week" ? sp.view : isOwner ? "week" : "today";
  const date = isISODate(sp.date) ? sp.date : today;

  // Everyone on the active crew (names for the cards).
  const { data: crewRows } = await supabase
    .from("crew_members")
    .select("id, full_name, is_dev, role, employment")
    .eq("active", true)
    .order("full_name");
  const crew = crewRows ?? [];
  const workers = crew.filter((c) => !c.is_dev); // the developer is never on jobs
  const names = new Map(crew.map((c) => [c.id as string, c.full_name as string]));
  const who = isOwner && sp.who && names.has(sp.who) ? sp.who : "";

  // Which dates to load.
  let from: string, to: string;
  if (view === "month") {
    from = mondayOf(firstOfMonth(date));
    to = addDays(mondayOf(lastOfMonth(date)), 6);
  } else if (view === "week") {
    from = mondayOf(date);
    to = addDays(from, 6);
  } else {
    from = date;
    to = isOwner && !who ? date : addDays(date, 21);
  }

  const { data: jobRows, error } = await supabase
    .from("jobs")
    .select(JOB_COLUMNS)
    .gte("job_date", from)
    .lte("job_date", to)
    .order("job_date")
    .order("start_time", { nullsFirst: false });
  // Crew only ever see their own jobs (the database does this for real crew logins; this covers "View as").
  const allJobs = isOwner ? ((jobRows ?? []) as Job[]) : visibleToCrew((jobRows ?? []) as Job[], me, today);
  const jobs = who ? allJobs.filter((j) => jobCrew(j).includes(who)) : allJobs;

  const href = (p: Partial<{ view: View; date: string; who: string }>) => {
    const s = new URLSearchParams();
    const v = p.view ?? view;
    const d = p.date ?? date;
    const w = p.who ?? who;
    s.set("view", v);
    if (d !== today) s.set("date", d);
    if (w) s.set("who", w);
    return `/schedule?${s.toString()}`;
  };

  // Weather: Stockton for every day, plus each job's own cities (next 7 days).
  const stockton = await stocktonForecast();
  const jobWx = await jobsForecast(jobs.filter((j) => j.status !== "canceled"), stockton);
  // Days 8-14: NOAA's rough outlook (a faded 🌦️ when it leans wetter than usual).
  const later = view === "today" ? null : await stocktonOutlook();
  const jobLater = await jobsOutlook(jobs.filter((j) => j.status !== "canceled" && j.job_date >= today), new Set(Object.keys(stockton)));
  const wetLater = (d: string) =>
    !stockton[d] && d >= today && !!later && d >= later.start && d <= later.end &&
    (outlookWet(later) || jobs.some((j) => j.job_date === d && outlookWet(jobLater.get(j.id))));
  const dayWx = (d: string) => {
    const home = stockton[d] ? { ...stockton[d], atSite: false } : null;
    let w: JobWx | null = home;
    for (const j of jobs) if (j.job_date === d && j.status !== "canceled") w = worse(w, jobWx.get(j.id));
    return w;
  };

  // Crew clock-in (only when Zach has it turned on, and only on the crew member's own screen).
  let clock: { open: TimeEntry | null; weekHours: number } | null = null;
  if (!isOwner && !who && (await getClockInEnabled(supabase))) {
    const [start, end] = weekBounds(mondayOf(today));
    const { data: mine } = await supabase
      .from("time_entries")
      .select(TIME_COLUMNS)
      .eq("crew_id", me.id)
      .or(`clock_out.is.null,clock_in.gte.${start}`)
      .lt("clock_in", end);
    const entries = (mine ?? []) as TimeEntry[];
    clock = {
      open: entries.find((e) => !e.clock_out) ?? null,
      weekHours: entries.filter((e) => e.clock_out).reduce((s, e) => s + entryHours(e), 0),
    };
  }

  // "Can't make this job?" on the crew member's own screen.
  let cover: { zachPhone: string; openByJob: Map<string, { id: string; reason: string }> } | null = null;
  if (!isOwner && !who) {
    const [{ data: cr }, prices] = await Promise.all([
      supabase.from("cover_requests").select(COVER_COLUMNS).eq("crew_id", me.id).eq("status", "open"),
      getPrices(supabase),
    ]);
    cover = {
      zachPhone: prices.business_phone,
      openByJob: new Map(((cr ?? []) as CoverRequest[]).map((c) => [c.job_id, { id: c.id, reason: c.reason }])),
    };
  }

  // "Meet up" on the crew's next job.
  const nextLive = !isOwner ? jobs.find((j) => j.job_date >= today && isLive(j)) : undefined;
  const meet = nextLive && view === "today" ? (await loadMeet(supabase, [nextLive], who ? { id: who, role: "mover" } : me, names)).get(nextLive.id) : undefined;
  const checklist = nextLive && view === "today" ? await loadChecklist(supabase, nextLive, jobWx.get(nextLive.id), names, who || me.id) : undefined;

  // Crew home: the "Get set up" checklist and shortcuts (their own screen, on today).
  const crewHome = !isOwner && !who && view === "today" && date === today;
  const setup: SetupItem[] | null = crewHome ? await setupFor(supabase, me) : null;
  // "My hours": this week and last week (hours only), when clock-in is on.
  let hours: { thisWeek: number; lastWeek: number } | null = null;
  if (crewHome && clock) {
    const [lastStart, lastEnd] = weekBounds(addDays(mondayOf(today), -7));
    const { data: prev } = await supabase.from("time_entries").select(TIME_COLUMNS).eq("crew_id", me.id).gte("clock_in", lastStart).lt("clock_in", lastEnd);
    hours = { thisWeek: clock.weekHours, lastWeek: ((prev ?? []) as TimeEntry[]).filter((e) => e.clock_out).reduce((n, e) => n + entryHours(e), 0) };
  }

  // Owner's week: scheduled hours for each crew member (owners and the developer aren't counted).
  let crewHours: { rows: ReturnType<typeof weekHours>; offDays: Map<string, number> } | null = null;
  if (isOwner && !who && view === "week") {
    const people = workers.filter((c) => c.role !== "owner") as CrewForHours[];
    const { data: offRows } = await supabase
      .from("time_off")
      .select("crew_id, start_date, end_date, until_time")
      .eq("status", "approved")
      .is("until_time", null)
      .lte("start_date", to)
      .gte("end_date", from);
    const offDays = new Map<string, number>();
    for (const o of offRows ?? []) {
      const s = (o.start_date as string) > from ? (o.start_date as string) : from;
      const e = (o.end_date as string) < to ? (o.end_date as string) : to;
      const n = Math.round((Date.parse(e) - Date.parse(s)) / 86_400_000) + 1;
      offDays.set(o.crew_id as string, Math.min(7, (offDays.get(o.crew_id as string) ?? 0) + n));
    }
    crewHours = { rows: weekHours(people, allJobs), offDays };
  }

  const dayJobs = (d: string) => jobs.filter((j) => j.job_date === d);
  const isDoubleBooked = (j: Job) => conflicts(j, allJobs.filter((o) => o.job_date === j.job_date)).length > 0;
  const whoName = who ? names.get(who) : "";

  const previewHrefs: Record<string, string> = { "": href({ who: "" }) };
  crew.forEach((c) => (previewHrefs[c.id] = href({ who: c.id })));

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader
        title={isOwner ? "Schedule" : crewHome ? "Home" : "My jobs"}
        isOwner={isOwner}
        name={me.full_name}
        roleLabel={roleLabel(me)}
        newJobHref={`/jobs/new?date=${view === "month" ? (date.slice(0, 7) === today.slice(0, 7) ? today : firstOfMonth(date)) : date}`}
        preview={isOwner ? { options: workers.map((c) => ({ id: c.id, name: c.full_name })), current: who, hrefFor: previewHrefs } : undefined}
      />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4">
        {whoName && (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-tape/15 px-4 py-3 text-sm text-ink">
            <span>
              Showing only <b>{whoName}</b>&apos;s jobs. This is what {whoName} sees.
            </span>
            <Link href={href({ who: "" })} className="shrink-0 font-semibold text-primary">
              Show everyone
            </Link>
          </div>
        )}

        {!onCall && <Toolbar view={view} date={date} today={today} href={href} />}

        {error && (
          <p className="rounded-2xl bg-bad/10 px-4 py-3 text-sm text-bad">
            Couldn&apos;t load the jobs. If this is the first time, the jobs table may not be set up yet in Supabase.
          </p>
        )}

        {isOwner && view !== "today" && <Summary lowHours={crewHours ? lowHoursCount(crewHours.rows) : 0} jobs={jobs.filter((j) => j.job_date >= (view === "month" ? firstOfMonth(date) : from) && j.job_date <= (view === "month" ? lastOfMonth(date) : to))} />}

        {view === "week" && (
          // Phone: a calendar-style agenda (big day number on the left, that day's jobs on the right).
          // Computer: seven columns, as before.
          <div className="flex flex-col gap-4 md:grid md:grid-cols-7 md:gap-2">
            {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((d, i) => {
              const list = dayJobs(d);
              const isToday = d === today;
              const wx = dayWx(d);
              return (
                <section key={d} aria-label={fmtDayLong(d)} className="grid grid-cols-[3.75rem_1fr] gap-3 md:flex md:flex-col md:gap-2">
                  {/* Day column: fixed width so every row lines up */}
                  <div
                    className={`flex h-min flex-col items-center rounded-2xl py-2 md:flex-row md:justify-start md:gap-2 md:rounded-xl md:px-2 md:py-1 ${
                      isToday ? "hero" : ""
                    }`}
                  >
                    <span className={`text-[11px] font-semibold uppercase tracking-wider ${isToday ? "text-tape" : "text-muted"}`}>{DAY_SHORT[i]}</span>
                    <span className="font-display text-3xl font-extrabold tabular-nums leading-none text-ink md:text-xl">{dayOfMonth(d)}</span>
                    <span className="mt-1 flex h-6 items-center md:mt-0 md:ml-auto" title={wx ? `${WX_LABEL[wx.kind]}${wx.hi != null ? `, high ${wx.hi}°` : ""}` : undefined}>
                      <span aria-hidden>
                        <WxIcon wx={wx} wetLater={wetLater(d)} size="md" />
                      </span>
                      {wx && <span className="sr-only">{WX_LABEL[wx.kind]}</span>}
                    </span>
                    {wx?.hi != null && <span className="text-[11px] tabular-nums text-muted md:hidden">{wx.hi}°</span>}
                  </div>

                  {/* That day's jobs */}
                  <div className="flex min-w-0 flex-col gap-2">
                    {list.map((j) => (
                      <JobCard key={j.id} job={j} names={names} doubleBooked={isDoubleBooked(j)} isOwner={isOwner} wx={jobWx.get(j.id)} outlook={jobLater.get(j.id)} />
                    ))}
                    {!list.length && (
                      <div className="flex min-h-14 items-center justify-between gap-2 rounded-2xl border border-dashed border-line px-4">
                        <span className="text-sm text-muted">No jobs</span>
                        {isOwner && (
                          <Link href={`/jobs/new?date=${d}`} className="press flex h-10 items-center gap-1 text-sm font-semibold text-primary" aria-label={`Add a job on ${fmtDayLong(d)}`}>
                            <Icon name="plus" className="h-4 w-4" /> Add
                          </Link>
                        )}
                      </div>
                    )}
                    {list.length > 0 && isOwner && (
                      <Link href={`/jobs/new?date=${d}`} className="press flex h-9 items-center gap-1 self-start px-1 text-sm font-semibold text-primary" aria-label={`Add another job on ${fmtDayLong(d)}`}>
                        <Icon name="plus" className="h-4 w-4" /> Add
                      </Link>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {crewHours && <CrewHours rows={crewHours.rows} offDays={crewHours.offDays} whoHref={(id) => href({ who: id })} />}

        {view === "month" && <Month date={date} today={today} from={from} jobs={jobs} href={href} dayWx={dayWx} wetLater={wetLater} />}

        {view === "today" &&
          (isOwner && !who ? (
            <section className="flex flex-col gap-3">
              <h1 className="font-display text-2xl font-extrabold uppercase text-ink">{fmtDayLong(date)}</h1>
              {stockton[date] && <WeatherNote wx={{ ...stockton[date], atSite: false }} />}
              <WorkingToday jobs={jobs} crew={workers} />
              <div className="grid gap-3 md:grid-cols-2">
                {jobs.map((j) => (
                  <JobCard key={j.id} job={j} names={names} doubleBooked={isDoubleBooked(j)} isOwner wx={jobWx.get(j.id)} outlook={jobLater.get(j.id)} />
                ))}
              </div>
              {!jobs.length && <p className="text-[15px] text-muted">No jobs on this day.</p>}
              <Link href={`/jobs/new?date=${date}`} className="press rounded-xl border border-dashed border-line py-3 text-center text-sm font-medium text-primary">
                + Add job
              </Link>
            </section>
          ) : (
            <>
              {setup && <SetupChecklist items={setup} />}
              <CrewToday jobs={jobs} names={names} meId={who || me.id} today={today} isDoubleBooked={isDoubleBooked} jobWx={jobWx} jobLater={jobLater} senderName={who ? undefined : me.full_name} clock={clock} cover={cover} meet={meet} checklist={checklist} />
              {hours && <MyHours {...hours} />}
              {crewHome && <CrewShortcuts />}
            </>
          ))}
      </main>
    </div>
  );
}

function Toolbar({
  view,
  date,
  today,
  href,
}: {
  view: View;
  date: string;
  today: string;
  href: (p: Partial<{ view: View; date: string }>) => string;
}) {
  const step = (n: number) =>
    view === "month" ? addMonths(date, n) : view === "week" ? addDays(mondayOf(date), 7 * n) : addDays(date, n);
  const label =
    view === "month"
      ? fmtMonth(date)
      : view === "week"
        ? mondayOf(date) === mondayOf(today)
          ? "This week"
          : `${fmtShort(mondayOf(date))} – ${fmtShort(addDays(mondayOf(date), 6))}`
        : date === today
          ? "Today"
          : fmtShort(date);
  const atCurrent =
    view === "month" ? date.slice(0, 7) === today.slice(0, 7) : view === "week" ? mondayOf(date) === mondayOf(today) : date === today;

  const tab = (v: View, text: string) => (
    <Link
      href={href({ view: v })}
      aria-current={view === v ? "page" : undefined}
      className={`press flex h-9 flex-1 items-center justify-center rounded-lg text-sm font-semibold ${
        view === v ? "bg-card text-ink shadow-sm" : "text-muted"
      }`}
    >
      {text}
    </Link>
  );
  const arrow = "press flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-card text-lg text-ink";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex rounded-xl bg-line/60 p-1 sm:w-72">
        {tab("today", "Today")}
        {tab("week", "Week")}
        {tab("month", "Month")}
      </div>
      <div className="flex items-center gap-2 sm:ml-auto">
        <Link href={href({ date: step(-1) })} className={arrow} aria-label="Back">
          <Icon name="back" className="h-4 w-4" />
        </Link>
        <span className="min-w-0 flex-1 text-center font-display text-lg font-bold uppercase tabular-nums text-ink sm:w-44 sm:flex-none">
          {label}
        </span>
        <Link href={href({ date: step(1) })} className={arrow} aria-label="Forward">
          <Icon name="chevron" className="h-4 w-4" />
        </Link>
        {/* Fixed-width slot so the arrows never move */}
        <span className="w-16">
          {!atCurrent && (
            <Link href={href({ date: today })} className="press flex h-10 items-center justify-center rounded-xl text-sm font-semibold text-primary">
              Today
            </Link>
          )}
        </span>
      </div>
    </div>
  );
}

function Summary({ jobs, lowHours = 0 }: { jobs: Job[]; lowHours?: number }) {
  const live = jobs.filter((j) => j.status !== "canceled");
  const hrs = live.reduce((s, j) => s + (Number(j.est_hours) || 0), 0);
  const noCrew = live.filter((j) => isLive(j) && !jobCrew(j).length).length;
  const open = live.filter(isLive).reduce((s, j) => s + openSpots(j), 0);
  const trucks = live.filter(needsTruck).length;
  const chip = "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium tabular-nums";
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className={`${chip} border-line text-ink`}>
        <b>{live.length}</b> job{live.length === 1 ? "" : "s"}
        {hrs ? ` · ${fmtHours(hrs)} est. hrs` : ""}
      </span>
      {noCrew > 0 && (
        <span className={`${chip} border-bad/40 text-bad`}>
          <Icon name="alert" className="h-3.5 w-3.5" /> No crew: <b>{noCrew}</b>
        </span>
      )}
      {trucks > 0 && (
        <span className={`${chip} border-warn/40 text-warn`}>
          <Icon name="truck" className="h-3.5 w-3.5" /> Trucks to reserve: <b>{trucks}</b>
        </span>
      )}
      {lowHours > 0 && (
        <a href="#crew-hours" className={`${chip} border-bad/40 text-bad`}>
          <Icon name="clock" className="h-3.5 w-3.5" /> Low on hours: <b>{lowHours}</b>
        </a>
      )}
      {live.length > 0 &&
        (open > 0 ? (
          <span className={`${chip} border-bad/40 text-bad`}>
            <b>{open}</b> open spot{open === 1 ? "" : "s"}
          </span>
        ) : (
          <span className={`${chip} border-ok/40 text-ok`}>
            <Icon name="check" className="h-3.5 w-3.5" /> Every job fully staffed
          </span>
        ))}
    </div>
  );
}

/** "8a", "8:30a", "1p": a start time that fits in a small month box. */
function shortTime(t: string | null) {
  const m = minutes(t);
  if (m == null) return "—";
  const h = Math.floor(m / 60), mm = m % 60;
  return `${h % 12 || 12}${mm ? `:${String(mm).padStart(2, "0")}` : ""}${h < 12 ? "a" : "p"}`;
}

/** "8:30a–2p": start and rough end, short enough for a phone's month box. */
function shortSpan(j: Pick<Job, "start_time" | "est_hours">) {
  const s = minutes(j.start_time);
  const h = Number(j.est_hours) || 0;
  if (s == null || !h) return shortTime(j.start_time);
  const end = s + h * 60;
  const e = `${String(Math.floor(end / 60) % 24).padStart(2, "0")}:${String(Math.round(end % 60)).padStart(2, "0")}`;
  return `${shortTime(j.start_time)}–${shortTime(e)}`;
}

/** "Lopez" from "Maria Lopez" (or "Example: Maria Lopez"). */
const lastName = (n: string) => n.replace(/^example:\s*/i, "").trim().split(/\s+/).pop() ?? "";

function Month({
  date,
  today,
  from,
  jobs,
  href,
  dayWx,
  wetLater,
}: {
  date: string;
  today: string;
  from: string;
  jobs: Job[];
  href: (p: Partial<{ view: View; date: string }>) => string;
  dayWx: (d: string) => JobWx | null;
  wetLater: (d: string) => boolean;
}) {
  const month = date.slice(0, 7);
  const last = addDays(mondayOf(lastOfMonth(date)), 6);
  const days: string[] = [];
  for (let d = from; d <= last; d = addDays(d, 1)) days.push(d);
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 pb-1">
        {DAY_SHORT.map((d) => (
          <span key={d} className="text-center text-[11px] font-semibold uppercase text-muted">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const list = jobs
            .filter((j) => j.job_date === d && j.status !== "canceled")
            .sort((a, b) => (minutes(a.start_time) ?? 9999) - (minutes(b.start_time) ?? 9999));
          const short = list.some((j) => isLive(j) && openSpots(j) > 0);
          const inMonth = d.slice(0, 7) === month;
          const isToday = d === today;
          const wx = dayWx(d);
          const wxText = wx ? `${WX_LABEL[wx.kind]}${wx.atSite ? " at a job site" : " in Stockton"}${wx.hi != null ? `, high ${wx.hi}°` : ""}` : "";
          return (
            <Link
              key={d}
              href={href({ view: "week", date: d })}
              aria-label={`${fmtDayLong(d)}: ${list.length} job${list.length === 1 ? "" : "s"}${short ? ", needs crew" : ""}${wxText ? ". " + wxText : ""}`}
              title={wxText || undefined}
              className={`press relative h-[8rem] min-w-0 overflow-hidden rounded-lg border bg-card md:h-28 ${
                inMonth ? "border-line" : "border-transparent bg-transparent opacity-40"
              }`}
            >
              {/* Fixed spot: date, top-left */}
              <span
                className={`absolute left-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums md:left-1 md:top-1 ${
                  isToday ? "bg-tape text-navy" : "text-ink"
                }`}
              >
                {dayOfMonth(d)}
              </span>
              {/* Fixed spot: weather, top-right. Orange circle = rain, snow, heat or wind; orange dot = at a job site, not Stockton. */}
              <span className="absolute right-0.5 top-0.5 md:right-1 md:top-1" aria-hidden>
                <WxIcon wx={wx} wetLater={wetLater(d)} />
              </span>
              {/* Fixed spot: one bar per job under the date, lined up on the left, earliest first (red = still needs crew).
                  Phones: time range on top, last name under it (2 jobs). Computers: one line each (3 jobs). The count has the total. */}
              {list.length > 0 && (
                <span className="absolute inset-x-0.5 top-[1.4rem] flex flex-col gap-0.5 md:inset-x-1 md:top-7">
                  {list.slice(0, 3).map((j, i) => (
                    <span
                      key={j.id}
                      className={`${i === 2 ? "hidden md:block" : "block"} overflow-hidden rounded px-[3px] md:truncate text-[9.5px] font-semibold leading-[12px] tabular-nums md:px-1 md:py-0 md:text-[11px] md:leading-4 ${
                        isLive(j) && openSpots(j) > 0 ? "bg-bad-fill text-white" : "bg-primary/10 text-primary"
                      }`}
                    >
                      <span className="block tracking-tight md:inline">{shortSpan(j).split("–").map((part, k) => (k ? <Fragment key={k}>–<wbr />{part}</Fragment> : part))}</span>
                      <span className="block truncate font-medium md:inline"><span className="hidden md:inline"> </span>{lastName(j.customer_name)}</span>
                    </span>
                  ))}
                </span>
              )}
              {/* Fixed spot: job count, bottom-center */}
              {list.length > 0 && (
                <span
                  className={`absolute bottom-1 left-1/2 flex h-5 min-w-5 -translate-x-1/2 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums ${
                    short ? "bg-bad-fill text-white" : "bg-primary text-white dark:text-navy"
                  }`}
                >
                  {list.length}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-primary" /> Jobs that day
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-bad-fill" /> A job still needs crew
        </span>
        <span className="flex items-center gap-1.5">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-warn-fill text-[9px] leading-none">🌧️</span> Rain, snow, heat or wind
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-warn-fill" /> Weather at a job site
        </span>
        <span>Weather: the forecast for the next 7 days; a faded 🌦️ on days 8–14 means NOAA&apos;s outlook leans wetter than usual (rough). Tap a day to open its week.</span>
      </div>
    </div>
  );
}

function WorkingToday({ jobs, crew }: { jobs: Job[]; crew: { id: string; full_name: string }[] }) {
  const live = jobs.filter((j) => j.status !== "canceled");
  const on = new Set(live.flatMap(jobCrew));
  if (!crew.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {crew.map((c) => (
        <span
          key={c.id}
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${on.has(c.id) ? "bg-ok/12 text-ok" : "bg-line/60 text-muted"}`}
        >
          {c.full_name} {on.has(c.id) ? "working" : "off"}
        </span>
      ))}
    </div>
  );
}

function CrewToday({
  jobs,
  names,
  meId,
  today,
  isDoubleBooked,
  jobWx,
  jobLater,
  senderName,
  clock,
  cover,
  meet,
  checklist,
}: {
  jobs: Job[];
  names: Map<string, string>;
  meId: string;
  today: string;
  isDoubleBooked: (j: Job) => boolean;
  jobWx: Map<string, JobWx>;
  jobLater: Map<string, JobOutlook>;
  senderName?: string;
  clock?: { open: TimeEntry | null; weekHours: number } | null;
  cover?: { zachPhone: string; openByJob: Map<string, { id: string; reason: string }> } | null;
  meet?: MeetInfo;
  checklist?: ChecklistItem[];
}) {
  const upcoming = jobs.filter((j) => j.job_date >= today && isLive(j));
  const [next, ...rest] = upcoming;
  const clockJob = clock?.open?.job_id ? jobs.find((j) => j.id === clock.open!.job_id) ?? next : next;
  return (
    <div className="flex flex-col gap-4">
      {clock && (
        <ClockCard
          open={clock.open}
          jobId={clockJob && clockJob.job_date === today ? clockJob.id : null}
          jobLabel={clockJob ? clockJob.customer_name : ""}
          weekHours={clock.weekHours}
        />
      )}
      {next ? (
        <NextJob
          job={next}
          names={names}
          meId={meId}
          today={today}
          wx={jobWx.get(next.id)}
          senderName={senderName}
          cover={cover ? { zachPhone: cover.zachPhone, open: cover.openByJob.get(next.id) ?? null } : undefined}
          meet={meet}
          checklist={checklist}
        />
      ) : (
        <section className="rounded-2xl border border-line bg-card p-5">
          <h2 className="font-display text-xl font-extrabold uppercase text-ink">No jobs coming up</h2>
          <p className="mt-1 text-[15px] text-muted">New jobs show up here as soon as Zach adds you.</p>
        </section>
      )}
      {rest.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-extrabold uppercase text-muted">Coming up (next 3 weeks)</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {rest.map((j) => (
              <div key={j.id} className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">{fmtDayLong(j.job_date)}</span>
                <JobCard job={j} names={names} doubleBooked={isDoubleBooked(j)} isOwner={false} wx={jobWx.get(j.id)} outlook={jobLater.get(j.id)} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}


/** Crew home: hours worked this week and last week (from clock-in). Hours only, no pay. */
function MyHours({ thisWeek, lastWeek }: { thisWeek: number; lastWeek: number }) {
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
      <h2 className="font-display text-lg font-extrabold uppercase text-ink">My hours</h2>
      <dl className="grid grid-cols-2 gap-2">
        {(
          [
            ["This week", thisWeek],
            ["Last week", lastWeek],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="rounded-xl bg-bg p-3">
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{k}</dt>
            <dd className="font-display text-2xl font-extrabold tabular-nums text-ink">{fmtDuration(v)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted">From your clock-in times. Ask Zach if something looks off.</p>
    </section>
  );
}
