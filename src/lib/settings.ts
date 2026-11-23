import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_PRICES, PRICE_COLUMNS, type Prices } from "./pricing";

/** Zach's current prices. Falls back to the starting prices if the settings table isn't set up yet. */
export async function getPrices(supabase: SupabaseClient): Promise<Prices> {
  let { data } = await supabase.from("settings").select(PRICE_COLUMNS).eq("id", 1).maybeSingle();
  if (!data) {
    // Before the texts setup (0004) runs, the expect_url column doesn't exist yet.
    ({ data } = await supabase.from("settings").select(PRICE_COLUMNS.replace(", expect_url", "")).eq("id", 1).maybeSingle());
  }
  if (!data) return DEFAULT_PRICES;
  const out = { ...DEFAULT_PRICES };
  for (const k of Object.keys(DEFAULT_PRICES) as (keyof Prices)[]) {
    const v = (data as Record<string, unknown>)[k];
    if (v == null) continue;
    (out as Record<string, unknown>)[k] = typeof DEFAULT_PRICES[k] === "string" ? String(v) : Number(v);
  }
  return out;
}
