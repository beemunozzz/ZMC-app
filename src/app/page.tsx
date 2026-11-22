import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { JobCard } from "@/components/JobCard";
import { NextJob } from "@/components/NextJob";
import { NotActive } from "@/components/NotActive";
import { PageLoading } from "@/components/PageLoading";
import { ROLE_LABEL, requireMember } from "@/lib/crew";
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
  mondayOf,
  todayISO,
} from "@/lib/dates";
import { JOB_COLUMNS, conflicts, isLive, jobCrew, openSpots, type Job } from "@/lib/jobs";
import { jobsForecast, stocktonForecast } from "@/lib/weather";
import { WX_EMOJI, WX_LABEL, worse, type DayWx, type JobWx } from "@/lib/weather-kinds";
import { WeatherNote } from "@/components/WeatherNote";

type View = "today" | "week" | "month";
type Search = { view?: string; date?: string; who?: string };

export default function Home({ searchParams }: { searchParams: Promise<Search> }) {
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
  const today = todayISO();
  const view: View = sp.view === "month" || sp.view === "today" || sp.view === "week" ? sp.view : isOwner ? "week" : "today";
  const date = isISODate(sp.date) ? sp.date : today;

  // Everyone on the active crew (names for the cards).
  const { data: crewRows } = await supabase
    .from("crew_members")
    .select("id, full_name")
    .eq("active", true)
    .order("full_name");
  const crew = crewRows ?? [];
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
  const allJobs = (jobRows ?? []) as Job[];
  const jobs = who ? allJobs.filter((j) => jobCrew(j).includes(who)) : allJobs;

  const href = (p: Partial<{ view: View; date: string; who: string }>) => {
    const s = new URLSearchParams();
    const v = p.view ?? view;
    const d = p.date ?? date;
    const w = p.who ?? who;
    s.set("view", v);
    if (d !== today) s.set("date", d);
    if (w) s.set("who", w);
    return `/?${s.toString()}`;
  };

  // Weather: Stockton for every day, plus each job's own cities (next 7 days).
  const stockton = await stocktonForecast();
  const jobWx = await jobsForecast(jobs.filter((j) => j.status !== "canceled"), stockton);
  const dayWx = (d: string) => {
    const home = stockton[d] ? { ...stockton[d], atSite: false } : null;
    let w: JobWx | null = home;
    for (const j of jobs) if (j.job_date === d && j.status !== "canceled") w = worse(w, jobWx.get(j.id));
    return w;
  };

  const dayJobs = (d: string) => jobs.filter((j) => j.job_date === d);
  const isDoubleBooked = (j: Job) => conflicts(j, allJobs.filter((o) => o.job_date === j.job_date)).length > 0;
  const whoName = who ? names.get(who) : "";

  const previewHrefs: Record<string, string> = { "": href({ who: "" }) };
  crew.forEach((c) => (previewHrefs[c.id] = href({ who: c.id })));

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader
        title={isOwner ? "Schedule" : "My jobs"}
        isOwner={isOwner}
        name={me.full_name}
        roleLabel={ROLE_LABEL[me.role]}
        newJobHref={`/jobs/new?date=${view === "month" ? (date.slice(0, 7) === today.slice(0, 7) ? today : firstOfMonth(date)) : date}`}
        preview={isOwner ? { options: crew.map((c) => ({ id: c.id, name: c.full_name })), current: who, hrefFor: previewHrefs } : undefined}
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

        <Toolbar view={view} date={date} today={today} href={href} />

        {error && (
          <p className="rounded-2xl bg-bad/10 px-4 py-3 text-sm text-bad">
            Couldn&apos;t load the jobs. If this is the first time, the jobs table may not be set up yet in Supabase.
          </p>
        )}

        {isOwner && view !== "today" && <Summary jobs={jobs.filter((j) => j.job_date >= (view === "month" ? firstOfMonth(date) : from) && j.job_date <= (view === "month" ? lastOfMonth(date) : to))} />}

        {view === "week" && (
          <div className="grid gap-3 md:grid-cols-7 md:gap-2">
            {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((d, i) => {
              const list = dayJobs(d);
              const isToday = d === today;
              return (
                <section key={d} aria-label={fmtDayLong(d)} className="flex flex-col gap-2">
                  <div className={`flex items-center gap-2 border-b pb-1 ${isToday ? "border-tape" : "border-line"}`}>
                    <span className={`font-display text-lg font-extrabold uppercase ${isToday ? "text-ink" : "text-muted"}`}>
                      {DAY_SHORT[i]}
                    </span>
                    <span className="text-sm tabular-nums text-muted">{fmtShort(d)}</span>
                    {isToday && <span className="rounded-full bg-tape/20 px-2 py-0.5 text-[11px] font-semibold text-ink">Today</span>}
                    <DayWeather wx={dayWx(d)} />
                    {isOwner && (
                      <Link
                        href={`/jobs/new?date=${d}`}
                        aria-label={`Add a job on ${fmtDayLong(d)}`}
                        className="press ml-auto flex h-9 items-center rounded-lg px-2 text-sm font-semibold text-primary"
                      >
                        + Add
                      </Link>
                    )}
                  </div>
                  {list.map((j) => (
                    <JobCard key={j.id} job={j} names={names} doubleBooked={isDoubleBooked(j)} isOwner={isOwner} wx={jobWx.get(j.id)} />
                  ))}
                  {!list.length && <p className="pb-1 text-sm text-muted">No jobs</p>}
                </section>
              );
            })}
          </div>
        )}

        {view === "month" && <Month date={date} today={today} from={from} jobs={jobs} href={href} dayWx={dayWx} />}

        {view === "today" &&
          (isOwner && !who ? (
            <section className="flex flex-col gap-3">
              <h1 className="font-display text-2xl font-extrabold uppercase text-ink">{fmtDayLong(date)}</h1>
              {stockton[date] && <WeatherNote wx={{ ...stockton[date], atSite: false }} />}
              <WorkingToday jobs={jobs} crew={crew} />
              <div className="grid gap-3 md:grid-cols-2">
                {jobs.map((j) => (
                  <JobCard key={j.id} job={j} names={names} doubleBooked={isDoubleBooked(j)} isOwner wx={jobWx.get(j.id)} />
                ))}
              </div>
              {!jobs.length && <p className="text-[15px] text-muted">No jobs on this day.</p>}
              <Link href={`/jobs/new?date=${date}`} className="press rounded-xl border border-dashed border-line py-3 text-center text-sm font-medium text-primary">
                + Add job
              </Link>
            </section>
          ) : (
            <CrewToday jobs={jobs} names={names} meId={who || me.id} today={today} isDoubleBooked={isDoubleBooked} jobWx={jobWx} />
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
          ‹
        </Link>
        <span className="min-w-0 flex-1 text-center font-display text-lg font-bold uppercase tabular-nums text-ink sm:w-44 sm:flex-none">
          {label}
        </span>
        <Link href={href({ date: step(1) })} className={arrow} aria-label="Forward">
          ›
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

function Summary({ jobs }: { jobs: Job[] }) {
  const live = jobs.filter((j) => j.status !== "canceled");
  const hrs = live.reduce((s, j) => s + (Number(j.est_hours) || 0), 0);
  const noCrew = live.filter((j) => isLive(j) && !jobCrew(j).length).length;
  const open = live.filter(isLive).reduce((s, j) => s + openSpots(j), 0);
  const chip = "rounded-full border px-3 py-1 text-xs font-medium tabular-nums";
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className={`${chip} border-line text-ink`}>
        <b>{live.length}</b> job{live.length === 1 ? "" : "s"}
        {hrs ? ` · ${fmtHours(hrs)} est. hrs` : ""}
      </span>
      {noCrew > 0 && (
        <span className={`${chip} border-bad/40 text-bad`}>
          ⚠ No crew: <b>{noCrew}</b>
        </span>
      )}
      {live.length > 0 &&
        (open > 0 ? (
          <span className={`${chip} border-warn/40 text-warn`}>
            <b>{open}</b> open spot{open === 1 ? "" : "s"}
          </span>
        ) : (
          <span className={`${chip} border-ok/40 text-ok`}>✓ Every job fully staffed</span>
        ))}
    </div>
  );
}

function Month({
  date,
  today,
  from,
  jobs,
  href,
  dayWx,
}: {
  date: string;
  today: string;
  from: string;
  jobs: Job[];
  href: (p: Partial<{ view: View; date: string }>) => string;
  dayWx: (d: string) => JobWx | null;
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
          const list = jobs.filter((j) => j.job_date === d && j.status !== "canceled");
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
              className={`press relative h-16 min-w-0 overflow-hidden rounded-lg border bg-card md:h-24 ${
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
              {/* Fixed spot: weather, top-right. Orange dot = weather at a job site, not Stockton. */}
              <span className="absolute right-0.5 top-1 flex h-4 w-4 items-center justify-center text-[11px] leading-none sm:text-[13px] md:right-1 md:text-base" aria-hidden>
                {wx ? WX_EMOJI[wx.kind] : ""}
                {wx?.atSite && <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-warn ring-2 ring-card" />}
              </span>
              {/* Fixed spot: job count, bottom-center */}
              {list.length > 0 && (
                <span
                  className={`absolute bottom-1 left-1/2 flex h-5 min-w-5 -translate-x-1/2 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums ${
                    short ? "bg-bad text-white dark:text-navy" : "bg-primary text-white dark:text-navy"
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
          <span className="h-3 w-3 rounded-full bg-bad" /> A job still needs crew
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-warn" /> Weather at a job site
        </span>
        <span>Weather shows for the next 7 days. Tap a day to open its week.</span>
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
}: {
  jobs: Job[];
  names: Map<string, string>;
  meId: string;
  today: string;
  isDoubleBooked: (j: Job) => boolean;
  jobWx: Map<string, JobWx>;
}) {
  const upcoming = jobs.filter((j) => j.job_date >= today && isLive(j));
  const [next, ...rest] = upcoming;
  return (
    <div className="flex flex-col gap-4">
      {next ? (
        <NextJob job={next} names={names} meId={meId} today={today} wx={jobWx.get(next.id)} />
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
                <JobCard job={j} names={names} doubleBooked={isDoubleBooked(j)} isOwner={false} wx={jobWx.get(j.id)} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** Emoji + high for a day heading. Fixed width so headings line up. */
function DayWeather({ wx }: { wx: (DayWx & { atSite?: boolean }) | null }) {
  if (!wx) return null;
  return (
    <span
      className="flex items-center gap-1 text-sm tabular-nums text-muted"
      title={`${WX_LABEL[wx.kind]}${wx.atSite ? " at a job site" : " in Stockton"}`}
    >
      <span aria-hidden className="relative">
        {WX_EMOJI[wx.kind]}
        {wx.atSite && <span className="absolute -bottom-0.5 -right-1 h-2 w-2 rounded-full bg-warn" />}
      </span>
      <span className="sr-only">{WX_LABEL[wx.kind]}</span>
      {wx.hi != null && <span>{wx.hi}°</span>}
    </span>
  );
}
