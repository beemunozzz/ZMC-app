"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/crew";
import { DEFAULT_PRICES, type Prices } from "@/lib/pricing";
import { COST_KEYS, PERCENT_COSTS } from "@/lib/truck-cost";

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
    if (k === "review_url") {
      if (raw && !/^https:\/\/\S+$/.test(raw)) return { error: "The Google review link should start with https://" };
      row.review_url = raw.slice(0, 400);
      continue;
    }
    if (k === "cancellation_policy") {
      row.cancellation_policy = raw.replace(/\s+/g, " ").slice(0, 240);
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
  if (!row.long_day_hours) return { error: "A long day needs a number of hours (more than 0)." };
  if (!row.allin_movers || !Number.isInteger(row.allin_movers)) return { error: "Movers included must be a whole number, 1 or more." };
  if (!row.min_movers || !Number.isInteger(row.min_movers)) return { error: "Minimum movers must be a whole number, 1 or more." };

  const { error } = await supabase.from("settings").update({ ...row, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) return { error: `Couldn't save: ${error.message}` };
  revalidatePath("/settings");
  return { ok: "Prices saved. New quotes use them right away." };
}

/** Owner: the shop address (where crew meet) and the extra minutes before leaving. */
export async function saveMeetSettings(_: { error?: string; ok?: string }, form: FormData): Promise<{ error?: string; ok?: string }> {
  const { supabase, me } = await requireMember();
  if (me?.role !== "owner") return { error: "Only the owner can change this." };
  const shop_address = String(form.get("shop_address") ?? "").trim().slice(0, 300);
  const meet_buffer_min = Number(form.get("meet_buffer_min") ?? 10);
  if (!Number.isInteger(meet_buffer_min) || meet_buffer_min < 0 || meet_buffer_min > 120) return { error: "Buffer should be 0 to 120 minutes." };
  const { error } = await supabase.from("settings").update({ shop_address, meet_buffer_min }).eq("id", 1);
  if (error) return { error: `Couldn't save: ${error.message}` };
  revalidatePath("/settings");
  revalidatePath("/schedule");
  return { ok: "Saved." };
}

/** Owner: the everyday load-up checklist (one item per line; "(rain)" = rain days only). */
export async function saveLoadList(_: { error?: string; ok?: string }, form: FormData): Promise<{ error?: string; ok?: string }> {
  const { supabase, me } = await requireMember();
  if (me?.role !== "owner") return { error: "Only the owner can change this." };
  const lines = String(form.get("load_list") ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 40);
  const { error } = await supabase.from("settings").update({ load_list: lines.join("\n") }).eq("id", 1);
  if (error) return { error: `Couldn't save: ${error.message}` };
  revalidatePath("/settings");
  revalidatePath("/schedule");
  return { ok: "Saved. Every job uses this list now." };
}

/** OWNER ONLY: what things cost us (truck rental, gas, margin). Percent fields come in as e.g. "9" and are saved as 0.09. */
export async function saveOwnerCosts(_: { error?: string; ok?: string }, form: FormData): Promise<{ error?: string; ok?: string }> {
  const { supabase, me } = await requireMember();
  if (me?.role !== "owner") return { error: "Only the owner can change this." };
  const row: Record<string, number> = {};
  for (const k of COST_KEYS) {
    const raw = String(form.get(k) ?? "").trim();
    const n = Number(raw);
    if (raw === "" || !Number.isFinite(n) || n < 0) return { error: "Every cost needs a number (0 or more)." };
    row[k] = PERCENT_COSTS.includes(k) ? n / 100 : n;
  }
  if (!row.truck_mpg || !row.follow_mpg) return { error: "Miles per gallon must be more than 0." };
  const { error } = await supabase.from("owner_costs").upsert({ id: 1, ...row, updated_at: new Date().toISOString() });
  if (error) return { error: `Couldn't save: ${error.message}` };
  revalidatePath("/settings");
  revalidatePath("/quotes", "layout");
  return { ok: "Costs saved." };
}
