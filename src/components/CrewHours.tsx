// OWNER: scheduled job hours for each crew member this week, so Zach can spread the work around.
// Full-time people under the "low" mark are flagged. Hours = the estimated hours of the jobs they're on.
import Link from "next/link";
import type { Employment } from "@/lib/crew-types";
import { fmtHours } from "@/lib/dates";
import { BAND_BAR, BAND_LABEL, BAND_TEXT, FULL_WEEK_HOURS, GOOD_HOURS, LOW_HOURS, hoursBand } from "@/lib/hours-alert";
import { jobCrew, type Job } from "@/lib/jobs";


export type CrewForHours = { id: string; full_name: string; role: string; employment?: Employment | null };

export function weekHours(people: CrewForHours[], weekJobs: Job[]) {
  const live = weekJobs.filter((j) => j.status !== "canceled");
  return people.map((p) => {
    const mine = live.filter((j) => jobCrew(j).includes(p.id));
    return { ...p, hours: mine.reduce((s, j) => s + (Number(j.est_hours) || 0), 0), jobs: mine.length };
  });
}

export const lowHoursCount = (rows: ReturnType<typeof weekHours>) =>
  rows.filter((r) => (r.employment ?? "full_time") === "full_time" && r.hours < LOW_HOURS).length;

export function CrewHours({ rows, offDays, whoHref }: { rows: ReturnType<typeof weekHours>; offDays: Map<string, number>; whoHref: (id: string) => string }) {
  const full = rows.filter((r) => (r.employment ?? "full_time") === "full_time").sort((a, b) => a.hours - b.hours);
  const others = rows.filter((r) => r.employment === "part_time" || r.employment === "on_call").sort((a, b) => a.hours - b.hours);
  if (!full.length && !others.length) return null;

  return (
    <section id="crew-hours" className="flex scroll-mt-20 flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-display text-lg font-extrabold uppercase text-ink">Crew hours this week</h2>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-ok" /> Full {GOOD_HOURS}+</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warn-fill" /> Light {LOW_HOURS}–{GOOD_HOURS}</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-bad-fill" /> Low under {LOW_HOURS}</span>
        </span>
      </div>

      {full.length > 0 && (
        <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {full.map((r) => {
            const band = hoursBand(r.hours);
            const off = offDays.get(r.id) ?? 0;
            const pct = Math.min(100, (r.hours / FULL_WEEK_HOURS) * 100);
            return (
              <li key={r.id}>
                <Link href={band !== "full" ? `/find-work/${r.id}` : whoHref(r.id)} className="press block rounded-lg">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-semibold text-ink">{r.full_name}</span>
                    <span className={`shrink-0 font-semibold tabular-nums ${BAND_TEXT[band]}`}>
                      {fmtHours(r.hours)} hrs · {BAND_LABEL[band].toLowerCase()}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-line" aria-hidden>
                    <div className={`h-full rounded-full ${BAND_BAR[band]}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-0.5 text-[11px] tabular-nums text-muted">
                    {r.jobs} job{r.jobs === 1 ? "" : "s"}
                    {off ? ` · off ${off} day${off === 1 ? "" : "s"}` : ""}
                    {band !== "full" ? <span className="font-semibold text-primary"> · Find work ›</span> : null}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {others.length > 0 && (
        <p className="border-t border-line pt-2 text-xs text-muted">
          <span className="font-semibold text-ink">Part-time and on call: </span>
          {others.map((r, i) => (
            <span key={r.id} className="tabular-nums">
              {i ? " · " : ""}
              {r.full_name.split(" ")[0]} {fmtHours(r.hours)}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
