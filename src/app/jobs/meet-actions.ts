"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/crew";
import { fmtDay } from "@/lib/dates";
import { notify } from "@/lib/push";

const UUID = /^[0-9a-f-]{36}$/i;
const CUTOFF = "After 8 PM the night before, call or text Zach to change where you meet.";

function refresh(jobId: string) {
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/schedule");
  revalidatePath("/");
}

/** Crew: "I'll meet you at the site" (own car), or take it back. Zach and the crew lead are told. */
export async function meetAtSite(jobId: string, on: boolean): Promise<{ error?: string }> {
  const { supabase, me } = await requireMember();
  if (!me || !UUID.test(jobId)) return { error: "Job not found." };
  const { data: job } = await supabase.from("jobs").select("customer_name, job_date, lead_id").eq("id", jobId).maybeSingle();
  if (!job) return { error: "Job not found." };

  const { error } = on
    ? await supabase.from("meet_at_site").insert({ job_id: jobId, crew_id: me.id })
    : await supabase.from("meet_at_site").delete().eq("job_id", jobId).eq("crew_id", me.id);
  if (error) {
    if (error.message.includes("duplicate")) return {};
    return { error: error.message.includes("row-level security") ? CUTOFF : `Couldn't save: ${error.message}` };
  }

  const lead = job.lead_id && job.lead_id !== me.id ? [job.lead_id as string] : [];
  await notify(supabase, { owners: true, crew: lead }, {
    title: on ? "Meeting at the site" : "Meeting at the shop",
    body: `${me.full_name.split(" ")[0]} will ${on ? "meet you at the site (own car)" : "meet at the shop after all"} · ${fmtDay(job.job_date as string)}, ${job.customer_name}`,
    url: `/jobs/${jobId}`,
    tag: `meet-${jobId}-${me.id}`,
  });
  refresh(jobId);
  return {};
}

/** Zach or the crew lead: everyone meets at the shop, or everyone meets at the site. Everyone on the job is told. */
export async function setJobMeet(jobId: string, at: "shop" | "site"): Promise<{ error?: string }> {
  const { supabase, me } = await requireMember();
  if (!me || !UUID.test(jobId) || (at !== "shop" && at !== "site")) return { error: "Job not found." };
  const { error } = await supabase.rpc("set_meet_at", { p_job: jobId, p_at: at });
  if (error) return { error: me.role === "owner" ? `Couldn't save: ${error.message}` : CUTOFF };

  const { data: job } = await supabase.from("jobs").select("customer_name, job_date, lead_id, crew_ids").eq("id", jobId).maybeSingle();
  if (job) {
    const crew = [job.lead_id, ...(job.crew_ids as string[])].filter((id): id is string => !!id && id !== me.id);
    await notify(supabase, { owners: me.role !== "owner", crew }, {
      title: at === "site" ? "Meet at the job site" : "Meet at the shop",
      body: `${fmtDay(job.job_date as string)}, ${job.customer_name}: ${me.full_name.split(" ")[0]} says everyone meets ${at === "site" ? "at the job site" : "at the shop"}.`,
      url: `/jobs/${jobId}`,
      tag: `meet-${jobId}`,
    });
  }
  refresh(jobId);
  return {};
}
