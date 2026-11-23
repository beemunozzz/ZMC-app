"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/crew";
import { DEFAULT_PRICES, type Prices } from "@/lib/pricing";

export type SettingsState = { error?: string; ok?: string };

export async function savePrices(_: SettingsState, form: FormData): Promise<SettingsState> {
  const { supabase, me } = await requireMember();
  if (me?.role !== "owner") return { error: "Only the owner can change prices." };

  const row: Partial<Prices> = {};
  for (const k of Object.keys(DEFAULT_PRICES) as (keyof Prices)[]) {
    const raw = String(form.get(k) ?? "").trim();
    if (k === "business_phone") {
      row.business_phone = raw.slice(0, 40) || DEFAULT_PRICES.business_phone;
      continue;
    }
    if (k === "zelle" || k === "cashapp" || k === "venmo" || k === "apple_cash") {
      row[k] = raw.slice(0, 80);
      continue;
    }
    if (k === "expect_url") {
      if (raw && !/^https:\/\/\S+$/.test(raw)) return { error: "The What to expect link should start with https://" };
      row.expect_url = raw.slice(0, 300);
      continue;
    }
    const n = Number(raw);
    if (raw === "" || !Number.isFinite(n) || n < 0) return { error: "Every price needs a number (0 or more)." };
    (row as Record<string, number>)[k] = n;
  }
  if (!row.trip_step_miles) return { error: "“Every … miles” must be more than 0." };
  if (!row.min_movers || !Number.isInteger(row.min_movers)) return { error: "Minimum movers must be a whole number, 1 or more." };

  const { error } = await supabase.from("settings").update({ ...row, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) return { error: `Couldn't save: ${error.message}` };
  revalidatePath("/settings");
  return { ok: "Prices saved. New quotes use them right away." };
}
