import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_PRICES, type Prices } from "./pricing";
import { COST_KEYS, DEFAULT_COSTS, type OwnerCosts } from "./truck-cost";

/** Zach's current prices and business settings. Falls back to the starting values for anything not set up yet. */
export async function getPrices(supabase: SupabaseClient): Promise<Prices> {
  // "*" so a setup step that hasn't run yet (missing columns) never breaks this; missing values use the defaults.
  const { data } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
  if (!data) return DEFAULT_PRICES;
  const out = { ...DEFAULT_PRICES };
  for (const k of Object.keys(DEFAULT_PRICES) as (keyof Prices)[]) {
    const v = (data as Record<string, unknown>)[k];
    if (v == null) continue;
    (out as Record<string, unknown>)[k] = typeof DEFAULT_PRICES[k] === "string" ? String(v) : Number(v);
  }
  return out;
}

/** OWNER ONLY: what things cost us (truck rental, gas, margin). Crew get nothing back from this table. */
export async function getOwnerCosts(supabase: SupabaseClient): Promise<OwnerCosts> {
  const { data } = await supabase.from("owner_costs").select("*").eq("id", 1).maybeSingle();
  const out = { ...DEFAULT_COSTS };
  if (data) for (const k of COST_KEYS) if ((data as Record<string, unknown>)[k] != null) out[k] = Number((data as Record<string, unknown>)[k]);
  return out;
}

/** Is crew clock-in turned on? (Zach's switch on the Payroll page.) False if not set up yet. */
export async function getClockInEnabled(supabase: SupabaseClient) {
  const { data } = await supabase.from("settings").select("clock_in_enabled").eq("id", 1).maybeSingle();
  return !!(data as { clock_in_enabled?: boolean } | null)?.clock_in_enabled;
}

/**
 * OWNER ONLY: the average hourly pay of the active crew (leads and movers, not owners), for estimating
 * crew pay on quotes. Null when no pay rates are set yet. Reads the owner-only crew_pay table.
 */
export async function getAvgCrewRate(supabase: SupabaseClient): Promise<{ rate: number; count: number } | null> {
  const [{ data: pay }, { data: crew }] = await Promise.all([
    supabase.from("crew_pay").select("crew_id, hourly_rate"),
    supabase.from("crew_members").select("id, role, active"),
  ]);
  const paid = new Set((crew ?? []).filter((c) => c.active && c.role !== "owner").map((c) => c.id as string));
  const rates = (pay ?? []).filter((p) => paid.has(p.crew_id as string) && Number(p.hourly_rate) > 0).map((p) => Number(p.hourly_rate));
  if (!rates.length) return null;
  return { rate: Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) / 100, count: rates.length };
}
