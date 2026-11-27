"use server";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

export type RateResult = { done?: boolean; error?: string; reviewUrl?: string };

/** The customer rates their move (no login: the long code in the link is the key). */
export async function rateMove(token: string, rating: number, comment: string): Promise<RateResult> {
  if (!/^[0-9a-f]{40,80}$/.test(token)) return { error: "This link isn't valid." };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Tap a star first." };
  const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const { data, error } = await db.rpc("rate_invoice", { p_token: token, p_rating: rating, p_comment: comment.slice(0, 2000) });
  if (error || data !== "ok") return { error: "Couldn't save that. Please try again." };
  const { data: info } = await db.rpc("public_invoice_rating", { p_token: token });
  const url = ((info ?? []) as { review_url: string }[])[0]?.review_url ?? "";
  return { done: true, reviewUrl: rating >= 4 ? url : "" };
}
