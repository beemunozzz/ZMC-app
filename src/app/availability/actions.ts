"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/crew";
import { fmtDay, isISODate } from "@/lib/dates";
import { notify } from "@/lib/push";

export type AvailState = { error?: string; ok?: string };
const UUID = /^[0-9a-f-]{36}$/i;
const t = (f: FormData, k: string, max = 300) => String(f.get(k) ?? "").trim().slice(0, max);

function refresh() {
  revalidatePath("/availability");
  revalidatePath("/payroll");
  revalidatePath("/schedule");
  revalidatePath("/");
}

/** Crew: mark time off. The database decides if it's automatic (7+ days ahead) or needs Zach's OK. */
export async function addTimeOff(_: AvailState, form: FormData): Promise<AvailState> {
  const { supabase, me } = await requireMember();
  if (!me) return { error: "Your account isn't active." };
  const start = t(form, "start_date", 10);
  const end = t(form, "end_date", 10) || start;
  const kind = t(form, "kind", 10);
  const until = kind === "until" ? t(form, "until_time", 5) : "";
  if (!isISODate(start) || !isISODate(end)) return { error: "Pick the date (or dates)." };
  if (end < start) return { error: "The last day can't be before the first day." };
  if (kind === "until" && !/^\d{2}:\d{2}$/.test(until)) return { error: "Pick the time you can work until." };

  const { data, error } = await supabase
    .from("time_off")
    .insert({ crew_id: me.id, start_date: start, end_date: end, until_time: until || null, note: t(form, "note", 200) })
    .select("status")
    .single();
  if (error) return { error: `Couldn't save: ${error.message}` };
  if (data.status === "pending")
    await notify(supabase, { owners: true }, {
      title: "Time-off request",
      body: `${me.full_name} asked off ${fmtDay(start)}${end !== start ? ` – ${fmtDay(end)}` : ""}${until ? ` after ${until}` : ""}. Approve or deny?`,
      url: "/",
      tag: "time-off",
    });
  refresh();
  return {
    ok:
      data.status === "approved"
        ? "Saved. Zach will see you're not available."
        : "Sent to Zach. That's less than 7 days away, so he needs to approve it.",
  };
}

export async function cancelTimeOff(form: FormData) {
  const { supabase, me } = await requireMember();
  const id = t(form, "id", 40);
  if (!me || !UUID.test(id)) return;
  await supabase.from("time_off").delete().eq("id", id);
  refresh();
}

/** Owner: approve or deny a late time-off request. */
export async function decideTimeOff(form: FormData) {
  const { supabase, me } = await requireMember();
  const id = t(form, "id", 40);
  const answer = t(form, "answer", 10) === "deny" ? "denied" : "approved";
  if (me?.role !== "owner" || !UUID.test(id)) return;
  const { data: row } = await supabase.from("time_off").select("crew_id, start_date, end_date").eq("id", id).maybeSingle();
  await supabase.from("time_off").update({ status: answer, decided_at: new Date().toISOString() }).eq("id", id);
  if (row)
    await notify(supabase, { crew: [row.crew_id as string] }, {
      title: answer === "approved" ? "Time off approved" : "Time off denied",
      body: `${fmtDay(row.start_date as string)}${row.end_date !== row.start_date ? ` – ${fmtDay(row.end_date as string)}` : ""}: ${answer === "approved" ? "you're off. Enjoy!" : "Zach needs you that day. Call him if you have questions."}`,
      url: "/availability",
      tag: "time-off",
    });
  refresh();
}

/** Crew: "I can't make this job." Goes to Zach so he can find cover. */
export async function requestCover(_: AvailState, form: FormData): Promise<AvailState> {
  const { supabase, me } = await requireMember();
  if (!me) return { error: "Your account isn't active." };
  const jobId = t(form, "job_id", 40);
  if (!UUID.test(jobId)) return { error: "Job not found." };
  const { error } = await supabase.from("cover_requests").insert({ job_id: jobId, crew_id: me.id, reason: t(form, "reason", 300) });
  if (error) {
    if (error.message.includes("cover_requests_one_open") || error.message.includes("duplicate")) return { ok: "You already told Zach. He's finding cover." };
    return { error: `Couldn't send: ${error.message}` };
  }
  const { data: job } = await supabase.from("jobs").select("customer_name, job_date").eq("id", jobId).maybeSingle();
  await notify(supabase, { owners: true }, {
    title: "Needs cover",
    body: `${me.full_name} can't make ${job ? `${job.customer_name} (${fmtDay(job.job_date as string)})` : "a job"}${t(form, "reason", 300) ? `: “${t(form, "reason", 300)}”` : ""}.`,
    url: `/jobs/${jobId}`,
    tag: `cover-${jobId}`,
  });
  revalidatePath(`/jobs/${jobId}`);
  refresh();
  return { ok: "Sent to Zach. You're still on the job until he finds cover, so text or call him too." };
}

export async function cancelCover(form: FormData) {
  const { supabase, me } = await requireMember();
  const id = t(form, "id", 40);
  const jobId = t(form, "job_id", 40);
  if (!me || !UUID.test(id)) return;
  await supabase.from("cover_requests").delete().eq("id", id).eq("status", "open");
  if (UUID.test(jobId)) revalidatePath(`/jobs/${jobId}`);
  refresh();
}

/** Owner: mark a cover request handled without changing the crew (e.g. they sorted it out). */
export async function resolveCover(form: FormData) {
  const { supabase, me } = await requireMember();
  const id = t(form, "id", 40);
  if (me?.role !== "owner" || !UUID.test(id)) return;
  await supabase.from("cover_requests").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", id);
  refresh();
}
