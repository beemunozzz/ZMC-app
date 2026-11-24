"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/crew";

const UUID = /^[0-9a-f-]{36}$/i;

/** Tick or untick one item on a job's load-up checklist. */
export async function tickItem(jobId: string, item: string, on: boolean): Promise<{ error?: string }> {
  const { supabase, me } = await requireMember();
  if (!me || !UUID.test(jobId) || !item || item.length > 80) return { error: "Couldn't save." };
  const { error } = on
    ? await supabase.from("job_checklist").upsert({ job_id: jobId, item, crew_id: me.id }, { onConflict: "job_id,item", ignoreDuplicates: true })
    : await supabase.from("job_checklist").delete().eq("job_id", jobId).eq("item", item);
  if (error) return { error: "Couldn't save. Only the crew on this job can tick items." };
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/schedule");
  return {};
}
