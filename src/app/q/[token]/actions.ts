"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { sendPush } from "@/lib/push";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

export type AcceptState = { error?: string; done?: boolean };

const REASONS: Record<string, string> = {
  not_found: "We couldn't find this estimate. Please call or text (209) 326-5601.",
  already: "This estimate has already been signed. You're all set!",
  closed: "This estimate is no longer open. Please call or text (209) 326-5601.",
  expired: "This estimate has expired. Please call or text (209) 326-5601 for an updated price.",
  date: "This move date has passed. Please call or text (209) 326-5601 to pick a new date.",
  name: "Please type your full name.",
  signature: "Please sign in the box with your finger.",
};

/** The customer signs and books (no login: the link's code is the key). Zach gets a notification. */
export async function acceptQuote(_: AcceptState, form: FormData): Promise<AcceptState> {
  const token = String(form.get("token") ?? "");
  const name = String(form.get("signed_name") ?? "").trim().slice(0, 120);
  const signature = String(form.get("signature") ?? "");
  if (form.get("agree") !== "on") return { error: "Please tick the box to accept the estimate and the not-to-exceed price." };
  if (!/^[0-9a-f]{40,80}$/.test(token)) return { error: REASONS.not_found };

  const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const { data, error } = await db.rpc("accept_quote", { p_token: token, p_signature: signature, p_name: name });
  if (error) return { error: "Something went wrong. Please try again, or call or text (209) 326-5601." };
  if (data !== "booked") return data === "already" ? { done: true } : { error: REASONS[data as string] ?? REASONS.not_found };

  // Tell Zach (needs the server's secret key; skipped quietly until notifications are set up).
  const key = process.env.CRON_SECRET;
  if (key) {
    const { data: phones } = await db.rpc("owner_push_targets", { p_key: key });
    await sendPush(
      ((phones ?? []) as { endpoint: string; p256dh: string; auth: string }[]).map((t) => ({
        ...t,
        msg: { title: "Quote signed and booked!", body: `${name} signed their estimate and booked online. Assign a crew.`, url: "/", tag: `booked-${token.slice(0, 8)}` },
      })),
    );
  }
  revalidatePath(`/q/${token}`);
  return { done: true };
}
