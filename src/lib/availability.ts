// Who's free for a job? Uses time off and other jobs. Safe to use on the server and the phone.
import { fmtTime, fmtMinutes, minutes } from "./dates";

export type TimeOff = {
  id: string;
  crew_id: string;
  start_date: string;
  end_date: string;
  /** null = not available all day; "15:00:00" = can only work until 3 PM */
  until_time: string | null;
  note: string;
  status: "approved" | "pending" | "denied";
  created_at: string;
};
export const TIME_OFF_COLUMNS = "id, crew_id, start_date, end_date, until_time, note, status, created_at";

export type CoverRequest = {
  id: string;
  job_id: string;
  crew_id: string;
  reason: string;
  status: "open" | "resolved";
  created_at: string;
};
export const COVER_COLUMNS = "id, job_id, crew_id, reason, status, created_at";

export type JobSlot = {
  id: string;
  job_date: string;
  start_time: string | null;
  est_hours: number | null;
  lead_id: string | null;
  crew_ids: string[];
  status: string;
  customer_name: string;
};

export type Availability =
  | { kind: "free"; text: string }
  | { kind: "off"; text: string }
  | { kind: "limited"; text: string }
  | { kind: "pending"; text: string }
  | { kind: "busy"; text: string };

/** "Can work until 3 PM" / "Not available" text for one time-off entry. */
export function timeOffText(t: Pick<TimeOff, "until_time">) {
  return t.until_time ? `Can work until ${fmtTime(t.until_time)}` : "Not available all day";
}

/**
 * Is this person free for a job on `date` from `start` (e.g. "08:00") for `hours`?
 * Worst news first: not available > on another job > only part of the day > asked off (waiting) > free.
 */
export function availabilityFor(
  crewId: string,
  date: string,
  start: string | null,
  hours: number,
  timeOff: TimeOff[],
  jobs: JobSlot[],
  excludeJobId?: string,
): Availability {
  const s = minutes(start) ?? 8 * 60;
  const e = s + (hours || 2) * 60;
  const mine = timeOff.filter((t) => t.crew_id === crewId && t.start_date <= date && t.end_date >= date && t.status !== "denied");

  const approved = mine.filter((t) => t.status === "approved");
  if (approved.some((t) => !t.until_time)) return { kind: "off", text: "Not available" };

  const clash = jobs.find(
    (j) =>
      j.id !== excludeJobId &&
      j.job_date === date &&
      j.status !== "canceled" &&
      (j.lead_id === crewId || j.crew_ids.includes(crewId)) &&
      (() => {
        const js = minutes(j.start_time);
        if (js == null) return true;
        const je = js + (Number(j.est_hours) || 2) * 60 + 30; // 30 min to drive between jobs
        return s < je && js < e + 30;
      })(),
  );
  if (clash) {
    const js = minutes(clash.start_time);
    return { kind: "busy", text: js == null ? "On another job" : `On another job ${fmtMinutes(js)}` };
  }

  const until = approved.filter((t) => t.until_time).map((t) => minutes(t.until_time)!);
  if (until.length) {
    const cutoff = Math.min(...until);
    if (cutoff < e) return { kind: "limited", text: `Only until ${fmtMinutes(cutoff)}` };
  }
  if (mine.some((t) => t.status === "pending")) return { kind: "pending", text: "Asked for time off" };
  return { kind: "free", text: "Free" };
}

export const AVAIL_STYLE: Record<Availability["kind"], { icon: string; cls: string }> = {
  free: { icon: "✓", cls: "text-ok" },
  off: { icon: "⛔", cls: "text-bad" },
  busy: { icon: "⚠", cls: "text-warn" },
  limited: { icon: "⚠", cls: "text-warn" },
  pending: { icon: "?", cls: "text-warn" },
};

/** Time off and jobs for the next ~4 months, for the crew picker. */
export async function loadAvailability(
  supabase: { from: (t: string) => any }, // eslint-disable-line @typescript-eslint/no-explicit-any
  from: string,
): Promise<{ timeOff: TimeOff[]; jobs: JobSlot[] }> {
  const [{ data: off }, { data: jobs }] = await Promise.all([
    supabase.from("time_off").select(TIME_OFF_COLUMNS).neq("status", "denied").gte("end_date", from),
    supabase.from("jobs").select("id, job_date, start_time, est_hours, lead_id, crew_ids, status, customer_name").gte("job_date", from).neq("status", "canceled"),
  ]);
  return { timeOff: (off ?? []) as TimeOff[], jobs: (jobs ?? []) as JobSlot[] };
}
