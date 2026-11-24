// Loads a job's load-up checklist. Server only.
import { itemsFor, type ChecklistItem } from "./checklist";
import type { Job } from "./jobs";
import type { JobWx } from "./weather-kinds";

export const DEFAULT_LOAD_LIST = [
  "Moving blankets",
  "Plastic wrap",
  "Ratchet straps",
  "4-wheel dollies",
  "Hand truck / appliance dolly",
  "Floor runners",
  "Door jamb protectors",
  "Tool bag",
  "Mattress bags",
  "Crew water",
  "Tarps and plastic covers (rain)",
].join("\n");

type Db = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function getLoadList(supabase: Db): Promise<string> {
  const { data } = await supabase.from("settings").select("load_list").eq("id", 1).maybeSingle();
  return (data?.load_list as string | undefined) ?? DEFAULT_LOAD_LIST;
}

/** This job's checklist with what's ticked and by whom (first name, or "You"). */
export async function loadChecklist(
  supabase: Db,
  job: Pick<Job, "id" | "load_extra">,
  wx: JobWx | null | undefined,
  names: Map<string, string>,
  meId: string,
): Promise<ChecklistItem[]> {
  const [list, { data }] = await Promise.all([getLoadList(supabase), supabase.from("job_checklist").select("item, crew_id").eq("job_id", job.id)]);
  const ticked = new Map(((data ?? []) as { item: string; crew_id: string | null }[]).map((r) => [r.item, r.crew_id]));
  return itemsFor(list, job.load_extra ?? "", wx?.kind === "rain").map((label) => {
    const by = ticked.get(label);
    return {
      label,
      done: ticked.has(label),
      by: ticked.has(label) ? (by === meId ? "You" : (names.get(by ?? "") ?? "Someone").split(" ")[0]) : undefined,
    };
  });
}
