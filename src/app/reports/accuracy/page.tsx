import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { PageLoading } from "@/components/PageLoading";
import { roleLabel, requireMember } from "@/lib/crew";
import { addDays, fmtShort, todayISO } from "@/lib/dates";
import type { House } from "@/lib/jobs";

export default function AccuracyPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Accuracy />
    </Suspense>
  );
}

type Row = {
  id: string;
  job_date: string;
  customer_name: string;
  job_type: string;
  est_hours: number | null;
  pickup_house: House | null;
  arrived_at: string | null;
  loaded_at: string | null;
  at_dropoff_at: string | null;
  done_at: string | null;
};

const hrsBetween = (a: string, b: string) => Math.max(0, (Date.parse(b) - Date.parse(a)) / 3_600_000);
const h1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
const fmtH = (n: number) => `${Math.floor(n)} h ${String(Math.round((n % 1) * 60)).padStart(2, "0")}`;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Zach: how close the estimated hours were to what jobs really took, and typical load/unload times by house size. */
async function Accuracy() {
  const { supabase, me } = await requireMember();
  if (!me || me.role !== "owner") redirect("/");
  const since = addDays(todayISO(), -365);
  const [{ data: jobRows }, { data: invRows }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, job_date, customer_name, job_type, est_hours, pickup_house, arrived_at, loaded_at, at_dropoff_at, done_at")
      .gte("job_date", since)
      .lte("job_date", todayISO())
      .neq("status", "canceled")
      .order("job_date", { ascending: false }),
    supabase.from("invoices").select("job_id, hours"),
  ]);
  const billed = new Map(((invRows ?? []) as { job_id: string; hours: number }[]).map((i) => [i.job_id, Number(i.hours)]));

  // Actual hours on the clock: the lead's taps (Arrived -> Done) when there are some, otherwise the invoice's hours.
  const rows = ((jobRows ?? []) as Row[])
    .map((j) => {
      const tapped = j.arrived_at && j.done_at ? hrsBetween(j.arrived_at, j.done_at) : null;
      const actual = tapped ?? billed.get(j.id) ?? null;
      return {
        ...j,
        est: Number(j.est_hours) || 0,
        actual,
        source: tapped != null ? "timeline" : "invoice",
        load: j.arrived_at && j.loaded_at ? hrsBetween(j.arrived_at, j.loaded_at) : null,
        drive: j.loaded_at && j.at_dropoff_at ? hrsBetween(j.loaded_at, j.at_dropoff_at) : null,
        unload: j.at_dropoff_at && j.done_at ? hrsBetween(j.at_dropoff_at, j.done_at) : null,
        beds: String(j.pickup_house?.beds ?? "").trim(),
        stories: String(j.pickup_house?.stories ?? "").trim(),
      };
    })
    .filter((r): r is typeof r & { actual: number } => r.actual != null && r.est > 0);

  const over = rows.filter((r) => r.actual - r.est > 0.5).length;
  const under = rows.filter((r) => r.est - r.actual > 0.5).length;
  const avgDiff = avg(rows.map((r) => r.actual - r.est));

  // Typical times by house size (from the lead's taps).
  const sizes = new Map<string, typeof rows>();
  for (const r of rows.filter((x) => x.load != null || x.unload != null)) {
    const k = r.beds ? `${r.beds} bed${r.stories ? ` · ${r.stories} stor${r.stories === "1" ? "y" : "ies"}` : ""}` : "House size not set";
    sizes.set(k, [...(sizes.get(k) ?? []), r]);
  }
  const byType = new Map<string, typeof rows>();
  for (const r of rows) byType.set(r.job_type, [...(byType.get(r.job_type) ?? []), r]);

  const card = "flex flex-col gap-2 rounded-2xl border border-line bg-card p-4";
  const h2 = "font-display text-lg font-extrabold uppercase text-ink";

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="Estimate accuracy" isOwner name={me.full_name} roleLabel={roleLabel(me)} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4">
        <p className="text-sm text-muted">
          Estimated hours vs. what jobs really took (the crew lead&apos;s Arrived → Done taps, or the invoice&apos;s hours when there are no taps). The
          more jobs, the better these numbers get: about 30 jobs gives a good picture.
        </p>

        {!rows.length ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
            No finished jobs with hours yet. Once crew leads tap the job timeline (or jobs are invoiced), the comparison shows up here.
          </p>
        ) : (
          <>
            <section className={card}>
              <h2 className={h2}>Overall · last 12 months</h2>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-bg px-2 py-2">
                  <p className="text-xl font-semibold tabular-nums text-ink">{rows.length}</p>
                  <p className="text-xs text-muted">jobs</p>
                </div>
                <div className="rounded-xl bg-bg px-2 py-2">
                  <p className={`text-xl font-semibold tabular-nums ${Math.abs(avgDiff) <= 0.5 ? "text-ok" : "text-warn"}`}>
                    {avgDiff >= 0 ? "+" : "−"}
                    {h1(Math.abs(avgDiff))} h
                  </p>
                  <p className="text-xs text-muted">average {avgDiff >= 0 ? "over" : "under"} the estimate</p>
                </div>
                <div className="rounded-xl bg-bg px-2 py-2">
                  <p className="text-xl font-semibold tabular-nums text-ink">
                    <span className="text-bad">{over}</span> / <span className="text-ok">{rows.length - over - under}</span> / <span className="text-primary">{under}</span>
                  </p>
                  <p className="text-xs text-muted">longer / on target / shorter</p>
                </div>
              </div>
              <p className="text-xs text-muted">On target = within 30 minutes of the estimate.</p>
            </section>

            {sizes.size > 0 && (
              <section className={card}>
                <h2 className={h2}>Typical times by house size</h2>
                <ul className="divide-y divide-line text-sm">
                  {[...sizes.entries()].map(([k, list]) => {
                    const load = avg(list.map((r) => r.load).filter((x): x is number => x != null));
                    const unload = avg(list.map((r) => r.unload).filter((x): x is number => x != null));
                    return (
                      <li key={k} className="flex items-center justify-between gap-3 py-2">
                        <span className="text-ink">
                          <b>{k}</b> <span className="text-muted">({list.length} job{list.length === 1 ? "" : "s"})</span>
                        </span>
                        <span className="text-right tabular-nums text-muted">
                          Load {load ? fmtH(load) : "—"} · Unload {unload ? fmtH(unload) : "—"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <section className={card}>
              <h2 className={h2}>By type of job</h2>
              <ul className="divide-y divide-line text-sm">
                {[...byType.entries()].map(([k, list]) => {
                  const d = avg(list.map((r) => r.actual - r.est));
                  return (
                    <li key={k} className="flex items-center justify-between gap-3 py-2">
                      <span className="text-ink">
                        <b>{k}</b> <span className="text-muted">({list.length})</span>
                      </span>
                      <span className={`tabular-nums ${Math.abs(d) <= 0.5 ? "text-ok" : d > 0 ? "text-bad" : "text-primary"}`}>
                        {d >= 0 ? "+" : "−"}
                        {h1(Math.abs(d))} h on average
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className={card}>
              <h2 className={h2}>Each job</h2>
              <ul className="divide-y divide-line text-sm">
                {rows.slice(0, 60).map((r) => {
                  const d = r.actual - r.est;
                  return (
                    <li key={r.id}>
                      <Link href={`/jobs/${r.id}`} className="flex items-center justify-between gap-3 py-2">
                        <span className="min-w-0">
                          <span className="block truncate text-ink">{r.customer_name}</span>
                          <span className="block text-xs text-muted">
                            {fmtShort(r.job_date)} · {r.job_type}
                            {r.beds ? ` · ${r.beds} bed` : ""} · from the {r.source}
                          </span>
                        </span>
                        <span className="shrink-0 text-right tabular-nums">
                          <span className="block text-ink">
                            {h1(r.est)} → {h1(r.actual)} h
                          </span>
                          <span className={`block text-xs font-semibold ${Math.abs(d) <= 0.5 ? "text-ok" : d > 0 ? "text-bad" : "text-primary"}`}>
                            {Math.abs(d) <= 0.5 ? "on target" : `${d > 0 ? "+" : "−"}${h1(Math.abs(d))} h`}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
