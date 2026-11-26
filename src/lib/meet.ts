// Where and when the crew meets for a job. Server only (uses the free map lookup for drive estimates).
import type { MeetInfo } from "@/components/MeetUp";
import { ZMC_TZ, addDays, fmtMinutes, fmtTime, minutes, todayISO } from "./dates";
import type { Job } from "./jobs";
import { geocode } from "./weather";

export type MeetSettings = { shop_address: string; meet_buffer_min: number };

/** Zach's shop address and the extra minutes before leaving. Safe if the setup step hasn't run yet. */
export async function getMeetSettings(supabase: { from: (t: string) => any }): Promise<MeetSettings> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data } = await supabase.from("settings").select("shop_address, meet_buffer_min").eq("id", 1).maybeSingle();
  return { shop_address: (data?.shop_address as string) ?? "", meet_buffer_min: Number(data?.meet_buffer_min ?? 10) };
}

const AVG_MPH = 45; // rough average for local driving with a truck
export const ROAD_FACTOR = 1.25; // roads are longer than a straight line

/** Straight-line miles between two map spots. */
export function milesBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Road miles -> drive minutes, rounded up to 5 (with 5 minutes for getting going). */
export function milesToMinutes(roadMiles: number) {
  return Math.ceil(((roadMiles / AVG_MPH) * 60 + 5) / 5) * 5;
}

export type Drive = { min: number; how: "typed" | "miles" | "estimate" } | null;

/** Drive time from the shop to the pickup: what Zach typed, else the job's miles out, else an estimate from the addresses. */
export async function driveFor(job: Pick<Job, "drive_min" | "miles_out" | "pickup_address">, shop: string): Promise<Drive> {
  if (job.drive_min != null) return { min: job.drive_min, how: "typed" };
  if (job.miles_out != null && Number(job.miles_out) > 0) return { min: milesToMinutes(Number(job.miles_out)), how: "miles" };
  if (!shop || !job.pickup_address) return null;
  const timeout = <T,>(p: Promise<T>) => Promise.race([p.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 3000))]);
  const [a, b] = await Promise.all([timeout(geocode(shop)), timeout(geocode(job.pickup_address))]);
  if (!a || !b) return null;
  return { min: milesToMinutes(milesBetween(a, b) * ROAD_FACTOR), how: "estimate" };
}

export type MeetPlan = {
  at: "shop" | "site";
  /** "8:10 AM" (shop) or the job start (site). Empty if the job has no start time. */
  time: string;
  /** Leave the shop by this time (shop only). */
  leave: string;
  drive: Drive;
};

/** Meet time at the shop = start - drive - buffer, rounded down to 5 minutes. */
export function meetPlan(job: Pick<Job, "meet_at" | "start_time">, drive: Drive, buffer: number): MeetPlan {
  const start = minutes(job.start_time);
  if (job.meet_at === "site" || start == null) {
    return { at: job.meet_at === "site" ? "site" : "shop", time: start == null ? "" : fmtMinutes(start), leave: "", drive };
  }
  const leave = start - (drive?.min ?? 30);
  const meet = Math.floor((leave - buffer) / 5) * 5;
  return { at: "shop", time: fmtMinutes(meet), leave: fmtMinutes(Math.floor(leave / 5) * 5), drive };
}


function driveText(d: Drive) {
  if (!d) return "Drive time unknown (figured 30 min)";
  if (d.how === "typed") return `${d.min} min drive`;
  return `About ${d.min} min drive`;
}

/** Past 8 PM the night before the job (Stockton time)? */
export function meetLocked(jobDate: string, now = new Date()) {
  const today = todayISO(now);
  const eve = addDays(jobDate, -1);
  if (today > eve) return true;
  if (today < eve) return false;
  const hm = new Intl.DateTimeFormat("en-GB", { timeZone: ZMC_TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  return (minutes(hm) ?? 0) >= 20 * 60;
}

/** Everything the "Meet up" card needs, for a few jobs at once. */
export async function loadMeet(
  supabase: { from: (t: string) => any }, // eslint-disable-line @typescript-eslint/no-explicit-any
  jobs: Job[],
  me: { id: string; role: string },
  names: Map<string, string>,
): Promise<Map<string, MeetInfo>> {
  const out = new Map<string, MeetInfo>();
  if (!jobs.length) return out;
  const [settings, { data: siteRows }] = await Promise.all([
    getMeetSettings(supabase),
    supabase.from("meet_at_site").select("job_id, crew_id").in("job_id", jobs.map((j) => j.id)),
  ]);
  const site = (siteRows ?? []) as { job_id: string; crew_id: string }[];
  await Promise.all(
    jobs.map(async (j) => {
      const drive = j.meet_at === "site" ? null : await driveFor(j, settings.shop_address);
      const plan = meetPlan(j, drive, settings.meet_buffer_min);
      const onJob = j.lead_id === me.id || j.crew_ids.includes(me.id);
      const locked = meetLocked(j.job_date);
      const here = site.filter((s) => s.job_id === j.id);
      out.set(j.id, {
        jobId: j.id,
        at: plan.at,
        time: plan.time,
        start: fmtTime(j.start_time),
        leave: plan.leave,
        driveText: plan.at === "shop" ? driveText(drive) : "",
        atSite: here.filter((s) => s.crew_id !== me.id).map((s) => (names.get(s.crew_id) ?? "Someone").split(" ")[0]),
        onJob,
        meAtSite: here.some((s) => s.crew_id === me.id),
        canChangeAll: me.role === "owner" || (j.lead_id === me.id && !locked),
        locked: onJob && me.role !== "owner" && locked,
      });
    }),
  );
  return out;
}
