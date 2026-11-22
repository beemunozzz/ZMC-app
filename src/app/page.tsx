import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { NotActive } from "@/components/NotActive";
import { PageLoading } from "@/components/PageLoading";
import { WeatherNote } from "@/components/WeatherNote";
import { ROLE_LABEL, requireMember } from "@/lib/crew";
import { DAY_SHORT, ZMC_TZ, addDays, dayOfMonth, fmtDay, fmtDayLong, fmtHours, mondayOf, todayISO } from "@/lib/dates";
import { JOB_COLUMNS, conflicts, isLive, jobCrew, openSpots, timeSpan, type Job } from "@/lib/jobs";
import { money } from "@/lib/pricing";
import type { QuoteStatus } from "@/lib/quotes";
import { jobsForecast, stocktonForecast } from "@/lib/weather";
import { WX_EMOJI, WX_LABEL, WX_WATCH, worse, type JobWx } from "@/lib/weather-kinds";

export default function HomePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Home />
    </Suspense>
  );
}

type Attention = { key: string; tone: "bad" | "warn"; text: string; sub: string; href: string };

async function Home() {
  const { supabase, me } = await requireMember();
  if (!me) return <NotActive />;
  if (me.role !== "owner") redirect("/schedule"); // crew keep their "next job" screen

  const today = todayISO();
  const weekStart = mondayOf(today);
  const weekEnd = addDays(weekStart, 6);
  const horizon = addDays(today, 13); // "needs attention" looks two weeks ahead
  const from = weekStart < today ? weekStart : today;

  const [{ data: jobRows }, { data: crewRows }, { data: quoteRows }, stockton] = await Promise.all([
    supabase.from("jobs").select(JOB_COLUMNS).gte("job_date", from).lte("job_date", horizon > weekEnd ? horizon : weekEnd).order("job_date").order("start_time", { nullsFirst: false }),
    supabase.from("crew_members").select("id, full_name, email, user_id").eq("active", true).order("full_name"),
    supabase.from("quotes").select("id, customer_name, status, created_at, quote_total, move_date").order("created_at", { ascending: false }).limit(300),
    stocktonForecast(),
  ]);
  const jobs = (jobRows ?? []) as Job[];
  const crew = crewRows ?? [];
  const names = new Map(crew.map((c) => [c.id as string, c.full_name as string]));
  const quotes = (quoteRows ?? []) as { id: string; customer_name: string; status: QuoteStatus; created_at: string; quote_total: number | null; move_date: string | null }[];

  const upcoming = jobs.filter((j) => j.job_date >= today && j.job_date <= horizon && isLive(j));
  const jobWx = await jobsForecast(upcoming, stockton);

  // ---- Today ----
  const todays = jobs.filter((j) => j.job_date === today && j.status !== "canceled");
  const working = new Set(todays.flatMap(jobCrew));

  // ---- Needs attention ----
  const attention: Attention[] = [];
  const when = (j: Job) => `${j.job_date === today ? "Today" : fmtDay(j.job_date)} · ${timeSpan(j)}`;
  for (const j of upcoming) {
    const people = jobCrew(j).length;
    if (!people) attention.push({ key: `nc${j.id}`, tone: "bad", text: `No crew: ${j.customer_name}`, sub: when(j), href: `/jobs/${j.id}/edit` });
    else if (openSpots(j) > 0)
      attention.push({ key: `os${j.id}`, tone: "warn", text: `Needs ${openSpots(j)} more: ${j.customer_name}`, sub: when(j), href: `/jobs/${j.id}/edit` });
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
      text: `${WX_EMOJI[x.kind]} ${WX_LABEL[x.kind]}: ${x.jobs.length === 1 ? x.jobs[0].customer_name : `${x.jobs.length} jobs`}`,
      sub: d === today ? "Today" : fmtDay(d),
      href: x.jobs.length === 1 ? `/jobs/${x.jobs[0].id}` : `/schedule?view=today&date=${d}`,
    });
  const newQuotes = quotes.filter((q) => q.status === "new");
  for (const q of newQuotes.slice(0, 5))
    attention.push({ key: `q${q.id}`, tone: "warn", text: `Quote waiting on a reply: ${q.customer_name}`, sub: q.move_date ? `Move ${fmtDay(q.move_date)}` : "No move date yet", href: `/quotes/${q.id}` });
  if (newQuotes.length > 5)
    attention.push({ key: "qmore", tone: "warn", text: `${newQuotes.length - 5} more quotes waiting`, sub: "Open Quotes", href: "/quotes" });
  attention.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "bad" ? -1 : 1));

  // ---- This week ----
  const week = jobs.filter((j) => j.job_date >= weekStart && j.job_date <= weekEnd && j.status !== "canceled");
  const weekHours = week.reduce((s, j) => s + (Number(j.est_hours) || 0), 0);
  const weekCrewHours = week.reduce((s, j) => s + (Number(j.est_hours) || 0) * jobCrew(j).length, 0);
  const weekStartUtc = new Date(`${weekStart}T08:00:00Z`).toISOString(); // Monday, about midnight in Stockton
  const weekQuotes = quotes.filter((q) => q.created_at >= weekStartUtc);
  const weekBooked = weekQuotes.filter((q) => q.status === "booked").length;
  const openQuoteValue = quotes.filter((q) => q.status === "new" || q.status === "quoted").reduce((s, q) => s + (Number(q.quote_total) || 0), 0);

  // ---- Greeting ----
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: ZMC_TZ, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const todayWx = stockton[today];

  const card = "rounded-2xl border border-line bg-card p-4";
  const h2 = "font-display text-lg font-extrabold uppercase text-ink";

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="Home" isOwner name={me.full_name} roleLabel={ROLE_LABEL[me.role]} newJobHref={`/jobs/new?date=${today}`} />

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4">
        {/* Greeting */}
        <section className="rise">
          <p className="text-sm text-muted">{fmtDayLong(today)}</p>
          <h1 className="font-display text-3xl font-extrabold uppercase leading-tight text-ink">
            {hello}, {me.full_name.split(" ")[0]}
          </h1>
          {todayWx && (
            <p className="mt-0.5 text-sm tabular-nums text-muted">
              {WX_EMOJI[todayWx.kind]} {todayWx.text || WX_LABEL[todayWx.kind]} in Stockton
              {todayWx.hi != null ? ` · high ${todayWx.hi}°` : ""}
            </p>
          )}
        </section>

        {/* Today at a glance */}
        <section className={card}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className={h2}>Today</h2>
            <Link href="/schedule?view=today" className="text-sm font-semibold text-primary">
              Open ›
            </Link>
          </div>
          {todays.length ? (
            <ul className="mt-2 divide-y divide-line">
              {todays.map((j) => {
                const n = jobCrew(j).length;
                return (
                  <li key={j.id}>
                    <Link href={`/jobs/${j.id}`} className="flex items-center gap-3 py-2.5">
                      <span className="w-16 shrink-0 text-sm font-semibold tabular-nums text-ink">{timeSpan(j).split(" – ")[0]}</span>
                      <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{j.customer_name}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                          !n ? "bg-bad/10 text-bad" : openSpots(j) ? "bg-warn/12 text-warn" : "bg-ok/12 text-ok"
                        }`}
                      >
                        {n}/{j.movers_needed} crew
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-1 text-[15px] text-muted">No jobs today.</p>
          )}
          {todays.length > 0 && (
            <p className="mt-2 text-sm text-muted">
              Working today:{" "}
              <span className="text-ink">{working.size ? [...working].map((id) => names.get(id) ?? "Removed").join(", ") : "nobody assigned yet"}</span>
            </p>
          )}
          {todayWx && WX_WATCH.includes(todayWx.kind) && (
            <div className="mt-3">
              <WeatherNote wx={{ ...todayWx, atSite: false }} />
            </div>
          )}
        </section>

        {/* Needs attention */}
        <section className={card}>
          <h2 className={h2}>
            Needs attention {attention.length > 0 && <span className="tabular-nums text-muted">({attention.length})</span>}
          </h2>
          {attention.length ? (
            <ul className="mt-2 divide-y divide-line">
              {attention.slice(0, 12).map((a) => (
                <li key={a.key}>
                  <Link href={a.href} className="flex items-center gap-3 py-2.5">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${a.tone === "bad" ? "bg-bad" : "bg-warn"}`} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-ink">{a.text}</span>
                      <span className="block truncate text-xs tabular-nums text-muted">{a.sub}</span>
                    </span>
                    <span className="text-lg text-muted" aria-hidden>
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[15px] font-medium text-ok">✓ All clear for the next two weeks.</p>
          )}
          {attention.length > 12 && <p className="mt-1 text-sm text-muted">+{attention.length - 12} more on the schedule.</p>}
        </section>

        {/* Tiles */}
        <nav aria-label="Go to" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Tile href="/schedule" icon="calendar" label="Schedule" />
          <Tile href={`/jobs/new?date=${today}`} icon="plus" label="New job" primary />
          <Tile href="/quotes" icon="chat" label="Quotes" badge={newQuotes.length ? `${newQuotes.length} new` : undefined} />
          <Tile href="/quotes/new" icon="plus" label="New quote" />
          <Tile href="/team" icon="people" label="Crew" />
          <Tile href="/settings" icon="tag" label="Prices" />
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
                  <span className="relative h-5 text-base leading-5" aria-hidden>
                    {w ? WX_EMOJI[w.kind] : ""}
                    {w?.atSite && <span className="absolute -bottom-0.5 -right-1 h-2 w-2 rounded-full bg-warn" />}
                  </span>
                  <span
                    className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold tabular-nums ${
                      !list.length ? "text-muted" : short ? "bg-bad text-white dark:text-navy" : "bg-primary text-white dark:text-navy"
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
  tag: (
    <>
      <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7.3 7.3a1 1 0 0 1-1.4 0z" />
      <circle cx="8" cy="8" r="1.4" />
    </>
  ),
};

function Tile({ href, icon, label, badge, primary }: { href: string; icon: keyof typeof ICONS; label: string; badge?: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`press relative flex h-24 flex-col justify-between rounded-2xl p-4 ${
        primary ? "bg-primary text-white dark:text-navy" : "border border-line bg-card text-ink"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {ICONS[icon]}
      </svg>
      <span className="font-display text-lg font-extrabold uppercase leading-none">{label}</span>
      {badge && (
        <span className="absolute right-3 top-3 rounded-full bg-warn/15 px-2 py-0.5 text-xs font-semibold text-warn">{badge}</span>
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
