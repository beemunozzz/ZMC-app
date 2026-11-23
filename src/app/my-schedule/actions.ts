"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/crew";
import { notify } from "@/lib/push";
import { WEEKDAYS, WEEKDAY_LABEL, WEEKLY_COLUMNS, cleanWeek, currentOf, weekChanges, type Week, type WeeklySchedule } from "@/lib/regular";

export type WeekState = { error?: string; ok?: string; at?: number };
const UUID = /^[0-9a-f-]{36}$/i;
const t = (f: FormData, k: string, max = 300) => String(f.get(k) ?? "").trim().slice(0, max);

function refresh() {
  revalidatePath("/my-schedule");
  revalidatePath("/payroll", "layout");
  revalidatePath("/schedule");
  revalidatePath("/");
}

function readWeek(form: FormData): { week?: Week; error?: string } {
  const raw: Record<string, unknown> = {};
  for (const d of WEEKDAYS) {
    const k = t(form, `${d}_k`, 5);
    if (k === "some") {
      const until = t(form, `${d}_until`, 5);
      if (!until) return { error: `${WEEKDAY_LABEL[d]}: pick the time you need to be off by.` };
      raw[d] = { k, until };
    } else raw[d] = { k: k === "off" ? "off" : "all" };
  }
  return { week: cleanWeek(raw) };
}

/** Crew: save the regular schedule. First one is saved right away; later changes go to Zach. */
export async function saveWeek(_: WeekState, form: FormData): Promise<WeekState> {
  const { supabase, me } = await requireMember();
  if (!me) return { error: "Your account isn't active." };
  const { week, error: bad } = readWeek(form);
  if (!week) return { error: bad };

  const { data: rows } = await supabase.from("weekly_schedules").select(WEEKLY_COLUMNS).eq("crew_id", me.id);
  const current = currentOf((rows ?? []) as WeeklySchedule[]);
  const before = current ? cleanWeek(current.days) : null;
  const changes = weekChanges(before, week);
  if (before && !changes.length) return { error: "Nothing changed from the schedule you have now." };

  // A new request replaces one that's still waiting.
  await supabase.from("weekly_schedules").delete().eq("crew_id", me.id).eq("status", "pending");
  const { data, error } = await supabase
    .from("weekly_schedules")
    .insert({ crew_id: me.id, days: week, note: t(form, "note", 300) })
    .select("status, is_original")
    .single();
  if (error) return { error: `Couldn't save: ${error.message}` };

  if (data.status === "pending")
    await notify(supabase, { owners: true }, {
      title: "Schedule change request",
      body: `${me.full_name} wants to change their regular schedule: ${changes.map((c) => `${WEEKDAY_LABEL[c.day].slice(0, 3)} ${c.before} → ${c.after}`).join("; ")}.`,
      url: "/",
      tag: `week-${me.id}`,
    });
  refresh();
  return {
    at: Date.now(),
    ok:
      data.status === "approved"
        ? "Saved. Zach will see this when he plans jobs."
        : "Sent to Zach. Your current schedule stays until he approves the change.",
  };
}

/** Crew: take back a change request that's still waiting. */
export async function cancelWeekRequest(form: FormData) {
  const { supabase, me } = await requireMember();
  const id = t(form, "id", 40);
  if (!me || !UUID.test(id)) return;
  await supabase.from("weekly_schedules").delete().eq("id", id).eq("status", "pending");
  refresh();
}

/** Owner: approve or deny a schedule change. */
export async function decideWeek(form: FormData) {
  const { supabase, me } = await requireMember();
  const id = t(form, "id", 40);
  const answer = t(form, "answer", 10) === "deny" ? "denied" : "approved";
  if (me?.role !== "owner" || !UUID.test(id)) return;
  const { data: row } = await supabase.from("weekly_schedules").select("crew_id, days").eq("id", id).eq("status", "pending").maybeSingle();
  if (!row) return;
  await supabase.from("weekly_schedules").update({ status: answer, decided_at: new Date().toISOString() }).eq("id", id);
  await notify(supabase, { crew: [row.crew_id as string] }, {
    title: answer === "approved" ? "Schedule change approved" : "Schedule change denied",
    body:
      answer === "approved"
        ? "Zach approved your new regular schedule."
        : "Zach kept your current regular schedule. Talk to him if you have questions.",
    url: "/my-schedule",
    tag: "week",
  });
  refresh();
}

