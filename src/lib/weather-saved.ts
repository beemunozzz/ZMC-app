// Saved weather: the forecast only covers upcoming days, so the app keeps the last forecast for each day
// (Stockton) and each job. Past days and jobs show what it was. Server only.
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "./dates";
import type { DayTemps } from "./weather";
import type { DayWx, JobWx } from "./weather-kinds";

export type SavedDay = { wx: DayWx | null; temps: DayTemps | null };
export type SavedJobWx = JobWx & { temps?: DayTemps | null };

/** Saved Stockton weather for a range of dates. */
export async function loadSavedDays(supabase: SupabaseClient, from: string, to: string): Promise<Record<string, SavedDay>> {
  const { data } = await supabase.from("weather_days").select("day, wx, temps").gte("day", from).lte("day", to);
  const out: Record<string, SavedDay> = {};
  for (const r of (data ?? []) as { day: string; wx: DayWx | null; temps: DayTemps | null }[]) out[r.day] = { wx: r.wx, temps: r.temps };
  return out;
}

/** The live forecast when it still has the daytime part, otherwise what was saved (past days, or tonight). */
export function mergeDays(live: Record<string, DayWx>, saved: Record<string, SavedDay>): Record<string, DayWx> {
  const out: Record<string, DayWx> = {};
  for (const [d, s] of Object.entries(saved)) if (s.wx) out[d] = s.wx;
  for (const [d, w] of Object.entries(live)) if (w.hi != null || !out[d]) out[d] = w;
  return out;
}

export function mergeTemps(live: Record<string, DayTemps>, saved: Record<string, SavedDay>): Record<string, DayTemps> {
  const out: Record<string, DayTemps> = {};
  for (const [d, s] of Object.entries(saved)) if (s.temps) out[d] = s.temps;
  for (const [d, t] of Object.entries(live)) out[d] = out[d] ? { lo: Math.min(out[d].lo, t.lo), hi: Math.max(out[d].hi, t.hi) } : t;
  return out;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Owner screens, after the page is sent: save today's and tomorrow's weather (Stockton and each job) so it's
 * still there after the day passes. Only saves forecasts that still have the daytime part, and only what changed.
 */
export async function saveWeather(
  supabase: SupabaseClient,
  today: string,
  live: { stockton: Record<string, DayWx>; temps: Record<string, DayTemps> },
  saved: Record<string, SavedDay>,
  jobs: { id: string; job_date: string; wx_saved?: SavedJobWx | null }[],
  jobWx: Map<string, JobWx>,
  jobTemps?: Map<string, DayTemps | null>,
) {
  if (process.env.ZMC_FAKE) return;
  try {
    const days = [today, addDays(today, 1)];
    const rows = days
      .map((d) => {
        const w = live.stockton[d];
        const wx = w?.hi != null ? w : (saved[d]?.wx ?? null);
        const t = live.temps[d];
        const old = saved[d]?.temps ?? null;
        const temps = t ? (old ? { lo: Math.min(old.lo, t.lo), hi: Math.max(old.hi, t.hi) } : t) : old;
        return { day: d, wx, temps };
      })
      .filter((r) => (r.wx || r.temps) && (!same(r.wx, saved[r.day]?.wx) || !same(r.temps, saved[r.day]?.temps)));
    if (rows.length) await supabase.from("weather_days").upsert(rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })), { onConflict: "day" });

    await saveJobsWx(supabase, today, jobs, jobWx, jobTemps);
  } catch {
    /* saving the weather is best-effort; never breaks a page */
  }
}

/** Save each of today's and tomorrow's jobs' weather (and working-hours temps) when it changed. */
export async function saveJobsWx(
  supabase: SupabaseClient,
  today: string,
  jobs: { id: string; job_date: string; wx_saved?: SavedJobWx | null }[],
  jobWx: Map<string, JobWx>,
  jobTemps?: Map<string, DayTemps | null>,
) {
  if (process.env.ZMC_FAKE) return;
  const days = [today, addDays(today, 1)];
  try {
    for (const j of jobs) {
      if (!days.includes(j.job_date)) continue;
      const w = jobWx.get(j.id);
      if (!w || w.hi == null) continue; // tonight-only forecast: keep what was saved during the day
      const live = jobTemps?.get(j.id) ?? null;
      const old = j.wx_saved?.temps ?? null;
      const temps = live && old ? { lo: Math.min(old.lo, live.lo), hi: Math.max(old.hi, live.hi) } : (live ?? old);
      const next: SavedJobWx = { ...w, temps };
      if (!same(next, j.wx_saved)) await supabase.from("jobs").update({ wx_saved: next }).eq("id", j.id);
    }
  } catch {
    /* best-effort */
  }
}

/** A job's weather to show: live when the forecast still has the day, otherwise what was saved. */
export function jobWxOrSaved(live: JobWx | undefined, saved: SavedJobWx | null | undefined): JobWx | undefined {
  if (live && (live.hi != null || !saved)) return live;
  return saved ?? live;
}
