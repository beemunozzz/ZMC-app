import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { PageLoading } from "@/components/PageLoading";
import { EMPLOYMENT, ROLE_LABEL, requireMember, type Employment } from "@/lib/crew";
import { addDays, fmtShort, isISODate, mondayOf, todayISO } from "@/lib/dates";
import { money } from "@/lib/pricing";
import { getClockInEnabled } from "@/lib/settings";
import { TIME_COLUMNS, clockDay, clockTime, entryHours, fmtDuration, weekBounds, type TimeEntry } from "@/lib/time";
import { fixEntry, ownerClockOut, setClockIn } from "./actions";

export default function PayrollPage({ searchParams }: PageProps<"/payroll">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Payroll searchParams={searchParams} />
    </Suspense>
  );
}

/** "2026-11-24T07:58" in Stockton time, for the fix-a-time boxes. */
function localInput(iso: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
function offsetFor(iso: string) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", timeZoneName: "shortOffset" }).formatToParts(new Date(iso)).find((p) => p.type === "timeZoneName")?.value ?? "GMT-8";
  const h = Number(name.replace("GMT", "") || "-8");
  return `${h < 0 ? "-" : "+"}${String(Math.abs(h)).padStart(2, "0")}:00`;
}

async function Payroll({ searchParams }: Pick<PageProps<"/payroll">, "searchParams">) {
  const sp = await searchParams;
  const { supabase, me } = await requireMember();
  if (!me || me.role !== "owner") redirect("/");

  const today = todayISO();
  const monday = typeof sp.week === "string" && isISODate(sp.week) ? mondayOf(sp.week) : mondayOf(today);
  const [start, end] = weekBounds(monday);
  const enabled = await getClockInEnabled(supabase);

  const [{ data: crewRows }, { data: payRows }, { data: entryRows }, { data: openRows }] = await Promise.all([
    supabase.from("crew_members").select("id, full_name, role, active, employment, phone").order("full_name"),
    supabase.from("crew_pay").select("crew_id, hourly_rate, terminated_at"),
    supabase.from("time_entries").select(TIME_COLUMNS).gte("clock_in", start).lt("clock_in", end).order("clock_in"),
    supabase.from("time_entries").select(TIME_COLUMNS).is("clock_out", null),
  ]);
  const crew = (crewRows ?? []) as { id: string; full_name: string; role: keyof typeof ROLE_LABEL; active: boolean; employment: Employment; phone: string | null }[];
  const terminatedIds = new Set((payRows ?? []).filter((r) => r.terminated_at).map((r) => r.crew_id as string));
  const names = new Map(crew.map((c) => [c.id, c.full_name]));
  const pay = new Map((payRows ?? []).map((r) => [r.crew_id as string, r.hourly_rate == null ? null : Number(r.hourly_rate)]));
  const entries = (entryRows ?? []) as TimeEntry[];
  const openNow = (openRows ?? []) as TimeEntry[];

  const jobIds = [...new Set(entries.map((e) => e.job_id).filter((x): x is string => !!x))];
  const { data: jobRows } = jobIds.length ? await supabase.from("jobs").select("id, customer_name").in("id", jobIds) : { data: [] };
  const jobName = new Map((jobRows ?? []).map((j) => [j.id as string, j.customer_name as string]));

  const rows = crew
    .map((c) => {
      const mine = entries.filter((e) => e.crew_id === c.id);
      const hours = mine.reduce((s, e) => s + entryHours(e), 0);
      const rate = pay.get(c.id) ?? null;
      return { ...c, hours, rate, pay: rate != null ? hours * rate : null, count: mine.length };
    })
    .filter((r) => r.active || r.count > 0);
  const totalHours = rows.reduce((s, r) => s + r.hours, 0);
  const totalPay = rows.reduce((s, r) => s + (r.pay ?? 0), 0);
  const missingRate = rows.some((r) => r.hours > 0 && r.rate == null);
  const thisWeek = monday === mondayOf(today);

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="Payroll" isOwner name={me.full_name} roleLabel={ROLE_LABEL[me.role]} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4">
        {/* The on/off switch */}
        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-xl font-extrabold uppercase text-ink">Crew clock-in</h1>
              <p className={`text-sm font-semibold ${enabled ? "text-ok" : "text-muted"}`}>{enabled ? "● On" : "○ Off"}</p>
            </div>
            <form action={setClockIn}>
              <input type="hidden" name="on" value={enabled ? "0" : "1"} />
              <button
                role="switch"
                aria-checked={enabled}
                aria-label="Crew clock-in"
                className={`relative h-9 w-16 shrink-0 rounded-full transition-colors ${enabled ? "bg-ok" : "bg-line"}`}
              >
                <span className={`absolute left-0 top-1 h-7 w-7 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-8" : "translate-x-1"}`} />
              </button>
            </form>
          </div>
          <p className="text-sm text-muted">
            {enabled
              ? "Crew see a Clock in / Clock out button on their job screen. Times come from the server clock, so they can't be changed on a phone. Invoices fill in the hours from the crew lead's time."
              : "Turned off: crew don't see any clock-in button, and invoices use the estimated hours. Turn it on to track hours and pay."}
          </p>
        </section>

        {/* Employees */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-extrabold uppercase text-ink">Employees</h2>
            <Link href="/team#add" className="press flex h-10 items-center rounded-xl bg-primary px-3.5 text-sm font-semibold text-white dark:text-navy">
              + Add employee
            </Link>
          </div>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {[...crew]
              .sort((a, b) => Number(terminatedIds.has(a.id)) - Number(terminatedIds.has(b.id)) || a.full_name.localeCompare(b.full_name))
              .map((c) => {
                const gone = terminatedIds.has(c.id) && !c.active;
                const r = pay.get(c.id);
                return (
                  <li key={c.id}>
                    <Link href={`/payroll/${c.id}`} className={`press flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg ${gone ? "opacity-60" : ""}`}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-ink">{c.full_name}</span>
                        <span className="block truncate text-xs text-muted">
                          {ROLE_LABEL[c.role]} · {r != null ? `${money(r)}/hr` : "No pay rate"}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          gone ? "bg-bad/10 text-bad" : c.employment === "leave" ? "bg-warn/12 text-warn" : c.employment === "on_call" ? "bg-primary/10 text-primary" : "bg-ok/12 text-ok"
                        }`}
                      >
                        {gone ? "Terminated" : EMPLOYMENT[c.employment ?? "full_time"].label}
                      </span>
                      <span className="text-lg text-muted" aria-hidden>
                        ›
                      </span>
                    </Link>
                  </li>
                );
              })}
          </ul>
          <p className="text-xs text-muted">Tap someone to see their file: contact info, pay and raises, employment type, or terminate.</p>
        </section>

        {/* On the clock now */}
        {openNow.length > 0 && (
          <section className="flex flex-col gap-2 rounded-2xl border border-ok/40 bg-card p-4">
            <h2 className="font-display text-lg font-extrabold uppercase text-ink">On the clock now</h2>
            <ul className="divide-y divide-line">
              {openNow.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 text-[15px] text-ink">
                    <b>{names.get(e.crew_id) ?? "Removed"}</b>
                    <span className="text-sm tabular-nums text-muted"> · since {clockTime(e.clock_in)} ({fmtDuration(entryHours(e))})</span>
                  </span>
                  <form action={ownerClockOut}>
                    <input type="hidden" name="entry_id" value={e.id} />
                    <button className="press h-10 shrink-0 whitespace-nowrap rounded-xl border border-line px-3 text-sm font-semibold text-ink">Clock out</button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Week picker */}
        <div className="flex items-center gap-2">
          <Link href={`/payroll?week=${addDays(monday, -7)}`} className="press flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-card text-lg text-ink" aria-label="Last week">
            ‹
          </Link>
          <span className="flex-1 text-center font-display text-lg font-bold uppercase tabular-nums text-ink">
            {thisWeek ? "This week" : `${fmtShort(monday)} – ${fmtShort(addDays(monday, 6))}`}
          </span>
          <Link href={`/payroll?week=${addDays(monday, 7)}`} className="press flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-card text-lg text-ink" aria-label="Next week">
            ›
          </Link>
        </div>

        {/* Hours and pay per person */}
        <section className="rounded-2xl border border-line bg-card">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-line px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted">
            <span>Crew</span>
            <span className="w-16 text-right">Hours</span>
            <span className="w-20 text-right">Pay</span>
          </div>
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium text-ink">{r.full_name}</span>
                  <span className="block text-xs tabular-nums text-muted">{r.rate != null ? `${money(r.rate)}/hr` : "No pay rate"}</span>
                </span>
                <span className="w-16 text-right text-[15px] tabular-nums text-ink">{r.hours ? (Math.round(r.hours * 100) / 100).toFixed(2) : "–"}</span>
                <span className="w-20 text-right text-[15px] font-semibold tabular-nums text-ink">{r.pay != null && r.hours ? money(Math.round(r.pay * 100) / 100) : "–"}</span>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-t-2 border-ink px-4 py-2.5">
            <span className="font-display text-lg font-extrabold uppercase text-ink">Total</span>
            <span className="w-16 text-right font-semibold tabular-nums text-ink">{totalHours ? totalHours.toFixed(2) : "–"}</span>
            <span className="w-20 text-right font-display text-lg font-extrabold tabular-nums text-ink">{totalPay ? money(Math.round(totalPay * 100) / 100) : "–"}</span>
          </div>
        </section>
        {missingRate && (
          <p className="text-sm text-warn">
            Some people have hours but no pay rate. Add it on{" "}
            <Link href="/team" className="font-semibold underline">
              Crew members
            </Link>
            .
          </p>
        )}
        <p className="text-xs text-muted">Pay is an estimate (hours × rate) before taxes or overtime. Use it as a starting point for real payroll.</p>

        {/* Every time entry this week, fixable */}
        {entries.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="font-display text-lg font-extrabold uppercase text-ink">Time entries</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
              {entries.map((e) => (
                <li key={e.id}>
                  <details className="group px-4 py-2.5">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-medium text-ink">
                          {names.get(e.crew_id) ?? "Removed"}
                          {e.job_id && jobName.get(e.job_id) ? <span className="font-normal text-muted"> · {jobName.get(e.job_id)}</span> : null}
                        </span>
                        <span className="block text-xs tabular-nums text-muted">
                          {clockDay(e.clock_in)} · {clockTime(e.clock_in)} – {e.clock_out ? clockTime(e.clock_out) : "now"}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{fmtDuration(entryHours(e))}</span>
                    </summary>
                    <form action={fixEntry} className="mt-3 flex flex-col gap-2">
                      <input type="hidden" name="entry_id" value={e.id} />
                      <input type="hidden" name="tz_offset" value={offsetFor(e.clock_in)} />
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted">
                          Clock in
                          <input type="datetime-local" name="clock_in" defaultValue={localInput(e.clock_in)} className="h-11 min-w-0 rounded-xl border border-line bg-bg px-2 text-sm text-ink" />
                        </label>
                        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted">
                          Clock out
                          <input type="datetime-local" name="clock_out" defaultValue={e.clock_out ? localInput(e.clock_out) : ""} className="h-11 min-w-0 rounded-xl border border-line bg-bg px-2 text-sm text-ink" />
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <button className="press h-10 flex-1 rounded-xl bg-primary text-sm font-semibold text-white dark:text-navy">Save fix</button>
                        <button name="delete" value="1" className="press h-10 rounded-xl border border-bad/40 px-4 text-sm font-semibold text-bad">
                          Delete
                        </button>
                      </div>
                    </form>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        )}
        {!entries.length && <p className="text-[15px] text-muted">{enabled ? "No clock-ins this week yet." : "No clock-ins this week. Clock-in is turned off."}</p>}
      </main>
    </div>
  );
}
