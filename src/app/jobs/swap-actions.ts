"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/crew";
import { addDays, fmtDay, fmtTime, todayISO } from "@/lib/dates";
import { notify } from "@/lib/push";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Zach: put `inId` on a job. With `outId`, they take that person's spot (a swap); without, they fill an open spot.
 * When the crew lead is swapped out, `leadId` says who leads now. Both people are notified.
 */
export async function swapCrew(jobId: string, outId: string | null, inId: string, leadId?: string | null): Promise<{ error?: string }> {
  const { supabase, me } = await requireMember();
  if (me?.role !== "owner") return { error: "Only Zach can change the crew." };
  if (!UUID.test(jobId) || !UUID.test(inId) || (outId && !UUID.test(outId))) return { error: "Job not found." };

  const { data: job } = await supabase.from("jobs").select("id, lead_id, crew_ids, job_date, start_time, customer_name, job_type, status").eq("id", jobId).maybeSingle();
  if (!job) return { error: "Job not found." };
  if (job.status === "canceled" || job.status === "done") return { error: "This job is finished or canceled." };
  const { data: person } = await supabase.from("crew_members").select("id, full_name, active, is_dev").eq("id", inId).maybeSingle();
  if (!person?.active || person.is_dev) return { error: "That person can't be put on jobs." };

  let lead: string | null = job.lead_id;
  let crew: string[] = [...(job.crew_ids ?? [])];
  if (lead === inId || crew.includes(inId)) return { error: `${person.full_name} is already on this job.` };

  if (outId) {
    if (outId === lead) {
      // The lead is leaving: someone else leads (the new person or someone already on the job).
      const remaining = [...crew, inId];
      const next = leadId && remaining.includes(leadId) ? leadId : null;
      if (!next) return { error: "Pick who leads this job now." };
      lead = next;
      crew = remaining.filter((c) => c !== next);
    } else if (crew.includes(outId)) {
      crew = crew.map((c) => (c === outId ? inId : c));
    } else return { error: "That person isn't on this job anymore. Refresh the page." };
  } else if (!lead && leadId === inId) {
    lead = inId;
  } else {
    crew.push(inId);
  }

  const { error } = await supabase.from("jobs").update({ lead_id: lead, crew_ids: crew }).eq("id", jobId);
  if (error) return { error: `Couldn't save: ${error.message}` };
  if (outId) {
    await supabase
      .from("cover_requests")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("job_id", jobId)
      .eq("crew_id", outId)
      .eq("status", "open");
  }

  // Tell both people (best-effort). "Tomorrow"/"Today" makes a last-minute change stand out.
  const today = todayISO();
  const day = job.job_date === today ? "Today" : job.job_date === addDays(today, 1) ? "Tomorrow" : fmtDay(job.job_date);
  const when = `${day}${job.start_time ? ` · ${fmtTime(job.start_time)}` : ""}`;
  if (inId !== me.id)
    await notify(supabase, { crew: [inId] }, { title: lead === inId ? "New job · you lead" : "New job", body: `${when} · ${job.job_type} · ${job.customer_name}`, url: `/jobs/${jobId}`, tag: `job-${jobId}` });
  if (outId && outId !== me.id)
    await notify(supabase, { crew: [outId] }, { title: "Taken off a job", body: `You're no longer on ${job.customer_name} (${when}).`, url: "/", tag: `job-${jobId}` });
  if (outId === job.lead_id && lead && lead !== inId && lead !== me.id)
    await notify(supabase, { crew: [lead] }, { title: "You're leading a job", body: `${when} · ${job.customer_name}`, url: `/jobs/${jobId}`, tag: `job-${jobId}` });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/schedule");
  revalidatePath("/");
  return {};
}
