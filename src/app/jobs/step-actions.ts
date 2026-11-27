"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/crew";

export type Step = "arrived" | "loaded" | "dropoff" | "done";

/** Crew lead (or Zach): record a moment of the job. Used to learn how long jobs really take. */
export async function setJobStep(jobId: string, step: Step, on: boolean): Promise<{ error?: string }> {
  const { supabase, me } = await requireMember();
  if (!me || !/^[0-9a-f-]{36}$/i.test(jobId)) return { error: "Job not found." };
  const { data, error } = await supabase.rpc("set_job_step", { p_job: jobId, p_step: step, p_on: on });
  if (error) return { error: `Couldn't save: ${error.message}` };
  if (data === "not_allowed") return { error: "Only the crew lead or Zach can tap these." };
  revalidatePath(`/jobs/${jobId}`);
  return {};
}
