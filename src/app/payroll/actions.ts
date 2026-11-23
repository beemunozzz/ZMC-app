"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/crew";

export type ClockState = { error?: string };
const UUID = /^[0-9a-f-]{36}$/i;

function refresh() {
  revalidatePath("/schedule");
  revalidatePath("/payroll");
  revalidatePath("/");
}

/** Crew member clocks in for a job. The server clock sets the time. */
export async function clockIn(_: ClockState, form: FormData): Promise<ClockState> {
  const { supabase, me } = await requireMember();
  if (!me) return { error: "Your account isn't active." };
  const jobId = String(form.get("job_id") ?? "");
  const { error } = await supabase.from("time_entries").insert({ crew_id: me.id, job_id: UUID.test(jobId) ? jobId : null });
  if (error) {
    if (error.message.includes("time_entries_one_open") || error.message.includes("duplicate")) return { error: "You're already clocked in." };
    if (error.message.includes("row-level security")) return { error: "Clock-in is turned off right now." };
    return { error: `Couldn't clock in: ${error.message}` };
  }
  refresh();
  return {};
}

/** Crew member clocks out of their open entry. */
export async function clockOut(_: ClockState, form: FormData): Promise<ClockState> {
  const { supabase, me } = await requireMember();
  if (!me) return { error: "Your account isn't active." };
  const id = String(form.get("entry_id") ?? "");
  if (!UUID.test(id)) return { error: "Nothing to clock out of." };
  const { error } = await supabase.from("time_entries").update({ clock_out: new Date().toISOString() }).eq("id", id).is("clock_out", null);
  if (error) return { error: `Couldn't clock out: ${error.message}` };
  refresh();
  return {};
}

/** Owner: turn crew clock-in on or off. */
export async function setClockIn(form: FormData) {
  const { supabase, me } = await requireMember();
  if (me?.role !== "owner") return;
  await supabase.from("settings").update({ clock_in_enabled: form.get("on") === "1" }).eq("id", 1);
  refresh();
}

/** Owner: clock someone out who forgot. */
export async function ownerClockOut(form: FormData) {
  const { supabase, me } = await requireMember();
  const id = String(form.get("entry_id") ?? "");
  if (me?.role !== "owner" || !UUID.test(id)) return;
  await supabase.from("time_entries").update({ clock_out: new Date().toISOString() }).eq("id", id).is("clock_out", null);
  refresh();
}

/** Owner: fix a time entry (times typed as Stockton local time, "YYYY-MM-DDTHH:MM"). */
export async function fixEntry(form: FormData) {
  const { supabase, me } = await requireMember();
  const id = String(form.get("entry_id") ?? "");
  if (me?.role !== "owner" || !UUID.test(id)) return;
  const tz = String(form.get("tz_offset") ?? "-08:00");
  const toIso = (v: FormDataEntryValue | null) => (v && String(v).length >= 16 ? new Date(`${String(v).slice(0, 16)}:00${tz}`).toISOString() : null);
  const clock_in = toIso(form.get("clock_in"));
  const clock_out = toIso(form.get("clock_out"));
  if (!clock_in) return;
  if (form.get("delete") === "1") {
    await supabase.from("time_entries").delete().eq("id", id);
  } else {
    await supabase.from("time_entries").update({ clock_in, clock_out }).eq("id", id);
  }
  refresh();
}
