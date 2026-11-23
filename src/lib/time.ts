// Crew clock-in helpers. Safe to use on the server and the phone.
import { ZMC_TZ, addDays } from "./dates";

export type TimeEntry = {
  id: string;
  crew_id: string;
  job_id: string | null;
  clock_in: string;
  clock_out: string | null;
};

export const TIME_COLUMNS = "id, crew_id, job_id, clock_in, clock_out";

/** Hours in an entry (an open entry counts up to `now`). */
export function entryHours(e: Pick<TimeEntry, "clock_in" | "clock_out">, now = Date.now()) {
  const end = e.clock_out ? Date.parse(e.clock_out) : now;
  return Math.max(0, (end - Date.parse(e.clock_in)) / 3_600_000);
}

/** Midnight in Stockton on this date, as an ISO time (handles daylight saving). */
export function stocktonMidnight(iso: string) {
  const noonUtc = new Date(`${iso}T12:00:00Z`);
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: ZMC_TZ, timeZoneName: "shortOffset" })
    .formatToParts(noonUtc)
    .find((p) => p.type === "timeZoneName")?.value; // e.g. "GMT-8"
  const hours = Number(offset?.replace("GMT", "") || "-8");
  return new Date(Date.parse(`${iso}T00:00:00Z`) - hours * 3_600_000).toISOString();
}

/** [start, end) of the Monday-to-Sunday week starting on `monday`, as ISO times. */
export function weekBounds(monday: string) {
  return [stocktonMidnight(monday), stocktonMidnight(addDays(monday, 7))] as const;
}

/** "7:58 AM" in Stockton time. */
export const clockTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { timeZone: ZMC_TZ, hour: "numeric", minute: "2-digit" });

/** "Mon, Nov 24" in Stockton time. */
export const clockDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { timeZone: ZMC_TZ, weekday: "short", month: "short", day: "numeric" });

/** 2.25 -> "2 h 15 m" */
export function fmtDuration(hours: number) {
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h} h${m ? ` ${m} m` : ""}` : `${m} m`;
}

/** Round up to the next quarter hour (for invoices). */
export const roundUpQuarter = (h: number) => Math.ceil(h * 4 - 1e-9) / 4;
