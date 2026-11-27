"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/crew";

/** Zach or the job's crew lead: the rental truck is booked (or not). */
export async function setTruckReserved(jobId: string, on: boolean): Promise<{ error?: string }> {
  const { supabase, me } = await requireMember();
  if (!me || !/^[0-9a-f-]{36}$/i.test(jobId)) return { error: "Job not found." };
  const { data, error } = await supabase.rpc("set_truck_reserved", { p_job: jobId, p_on: on });
  if (error) return { error: `Couldn't save: ${error.message}` };
  if (data === "not_allowed") return { error: "Only Zach or this job's crew lead can change this." };
  if (data !== "ok") return { error: "Job not found." };
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/schedule");
  revalidatePath("/");
  return {};
}
