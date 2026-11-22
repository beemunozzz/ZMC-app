import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_PRICES, PRICE_COLUMNS, type Prices } from "./pricing";

/** Zach's current prices. Falls back to the starting prices if the settings table isn't set up yet. */
export async function getPrices(supabase: SupabaseClient): Promise<Prices> {
  const { data } = await supabase.from("settings").select(PRICE_COLUMNS).eq("id", 1).maybeSingle();
  if (!data) return DEFAULT_PRICES;
  const out = { ...DEFAULT_PRICES };
  for (const k of Object.keys(DEFAULT_PRICES) as (keyof Prices)[]) {
    const v = (data as Record<string, unknown>)[k];
    if (v == null) continue;
    (out as Record<string, unknown>)[k] = k === "business_phone" ? String(v) : Number(v);
  }
  return out;
}
