"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/crew";

/** Zach: "Got it" on a low-hours alert. It won't show again for that person this week. */
export async function ackLowHours(form: FormData) {
  const { supabase, me } = await requireMember();
  if (me?.role !== "owner") return;
  const crewId = String(form.get("crew_id") ?? "");
  const week = String(form.get("week") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(crewId) || !/^\d{4}-\d{2}-\d{2}$/.test(week)) return;
  await supabase.from("hours_alert_acks").upsert({ week_start: week, crew_id: crewId }, { onConflict: "week_start,crew_id" });
  revalidatePath("/");
}
