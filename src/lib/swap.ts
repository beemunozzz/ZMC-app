// Swapping crew: who could take a spot on a job, and their hours that week. Owner screens only.
// Server only (loads from the database).
import type { SupabaseClient } from "@supabase/supabase-js";
import { availabilityFor, loadAvailability, type Availability, type JobSlot } from "./availability";
import { addDays, mondayOf } from "./dates";
import type { Job } from "./jobs";

export type Candidate = {
  id: string;
  name: string;
  role: string;
  /** Full-time crew get the green/orange/red hours colors; part-time and on-call don't. */
  fullTime: boolean;
  /** Scheduled job hours that week (Monday to Sunday). */
  weekHours: number;
  avail: Availability;
  /** Can be picked: not off and not on another job at the same time. */
  ok: boolean;
};

type Person = { id: string; full_name: string; role: string; employment: string | null; is_dev: boolean; active: boolean };

export async function loadPeople(supabase: SupabaseClient) {
  const { data } = await supabase.from("crew_members").select("id, full_name, role, employment, is_dev, active").eq("active", true).order("full_name");
  return ((data ?? []) as Person[]).filter((p) => !p.is_dev && p.employment !== "leave");
}

export function weekHoursOf(id: string, jobs: JobSlot[], week: string) {
  const end = addDays(week, 6);
  return jobs
    .filter((j) => j.job_date >= week && j.job_date <= end && j.status !== "canceled" && (j.lead_id === id || j.crew_ids.includes(id)))
    .reduce((s, j) => s + (Number(j.est_hours) || 0), 0);
}

/** Everyone who isn't on this job, best picks first: free, then fewest hours that week. */
export async function swapCandidates(supabase: SupabaseClient, job: Job): Promise<Candidate[]> {
  const [people, avail] = await Promise.all([loadPeople(supabase), loadAvailability(supabase, mondayOf(job.job_date))]);
  const onJob = new Set([job.lead_id, ...(job.crew_ids ?? [])].filter(Boolean) as string[]);
  const week = mondayOf(job.job_date);
  const rank = { free: 0, pending: 1, limited: 2, busy: 3, off: 4 } as const;
  return people
    .filter((p) => !onJob.has(p.id))
    .map((p) => {
      const a = availabilityFor(p.id, job.job_date, job.start_time, Number(job.est_hours) || 2, avail.timeOff, avail.jobs, job.id, avail.regular);
      return { id: p.id, name: p.full_name, role: p.role, fullTime: (p.employment ?? "full_time") === "full_time" && p.role !== "owner", weekHours: weekHoursOf(p.id, avail.jobs, week), avail: a, ok: a.kind !== "off" && a.kind !== "busy" };
    })
    .sort((a, b) => rank[a.avail.kind] - rank[b.avail.kind] || a.weekHours - b.weekHours || a.name.localeCompare(b.name));
}
