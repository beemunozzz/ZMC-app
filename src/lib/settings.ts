import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_PRICES, PRICE_COLUMNS, type Prices } from "./pricing";

// If a newer setup step hasn't been run in Supabase yet, its columns don't exist. Try newest first.
const COLUMN_SETS = [
  PRICE_COLUMNS,
  PRICE_COLUMNS.replace(", zelle, cashapp, venmo, apple_cash", ""), // before step 0005
  PRICE_COLUMNS.replace(", expect_url, zelle, cashapp, venmo, apple_cash", ""), // before step 0004
];

/** Zach's current prices and business settings. Falls back to the starting values if not set up yet. */
export async function getPrices(supabase: SupabaseClient): Promise<Prices> {
  let data: Record<string, unknown> | null = null;
  for (const cols of COLUMN_SETS) {
    const res = await supabase.from("settings").select(cols).eq("id", 1).maybeSingle();
    if (res.data) {
      data = res.data as unknown as Record<string, unknown>;
      break;
    }
  }
  if (!data) return DEFAULT_PRICES;
  const out = { ...DEFAULT_PRICES };
  for (const k of Object.keys(DEFAULT_PRICES) as (keyof Prices)[]) {
    const v = data[k];
    if (v == null) continue;
    (out as Record<string, unknown>)[k] = typeof DEFAULT_PRICES[k] === "string" ? String(v) : Number(v);
  }
  return out;
}

/** Is crew clock-in turned on? (Zach's switch on the Payroll page.) False if not set up yet. */
export async function getClockInEnabled(supabase: SupabaseClient) {
  const { data } = await supabase.from("settings").select("clock_in_enabled").eq("id", 1).maybeSingle();
  return !!(data as { clock_in_enabled?: boolean } | null)?.clock_in_enabled;
}
