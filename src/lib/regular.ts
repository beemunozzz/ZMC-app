// A crew member's regular weekly schedule ("off by 6 PM on Tuesdays", "not available Mondays").
// Safe to use on both the server and the phone.
import { fmtTime, minutes } from "./dates";

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export const WEEKDAY_LABEL: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/** all = available all day · off = not available · some = only some hours (from and/or until). */
export type DayRule = { k: "all" } | { k: "off" } | { k: "some"; from?: string; until?: string };
export type Week = Record<Weekday, DayRule>;

export type WeeklySchedule = {
  id: string;
  crew_id: string;
  days: Week;
  note: string;
  status: "approved" | "pending" | "denied";
  is_original: boolean;
  created_at: string;
  decided_at: string | null;
};
export const WEEKLY_COLUMNS = "id, crew_id, days, note, status, is_original, created_at, decided_at";

export const ALL_WEEK: Week = { mon: { k: "all" }, tue: { k: "all" }, wed: { k: "all" }, thu: { k: "all" }, fri: { k: "all" }, sat: { k: "all" }, sun: { k: "all" } };

const HHMM = /^\d{2}:\d{2}$/;

/** Clean up whatever came from the database or a form, so a bad value can never break a screen. */
export function cleanWeek(raw: unknown): Week {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = { ...ALL_WEEK };
  for (const d of WEEKDAYS) {
    const r = (src[d] ?? {}) as Record<string, unknown>;
    if (r.k === "off") out[d] = { k: "off" };
    else if (r.k === "some") {
      const from = typeof r.from === "string" && HHMM.test(r.from) ? r.from.slice(0, 5) : undefined;
      const until = typeof r.until === "string" && HHMM.test(r.until) ? r.until.slice(0, 5) : undefined;
      out[d] = from || until ? { k: "some", ...(from ? { from } : {}), ...(until ? { until } : {}) } : { k: "all" };
    }
  }
  return out;
}

/** Monday-first weekday of a "YYYY-MM-DD" date. */
export function weekdayOf(iso: string): Weekday {
  return WEEKDAYS[(new Date(iso + "T00:00:00Z").getUTCDay() + 6) % 7];
}

/** "Available all day" / "Not available" / "9 AM – 6 PM" / "Off by 6 PM" / "Can start at 9 AM". */
export function ruleText(r: DayRule) {
  if (r.k === "all") return "Available all day";
  if (r.k === "off") return "Not available";
  if (r.from && r.until) return `${fmtTime(r.from)} – ${fmtTime(r.until)}`;
  if (r.until) return `Off by ${fmtTime(r.until)}`;
  return `Can start at ${fmtTime(r.from!)}`;
}

/** The days that aren't "available all day", for a one-line summary. */
export function weekSummary(w: Week) {
  const parts = WEEKDAYS.filter((d) => w[d].k !== "all").map((d) => `${WEEKDAY_LABEL[d].slice(0, 3)}: ${ruleText(w[d])}`);
  return parts.length ? parts.join(" · ") : "Available every day";
}

/** Which days changed between two versions (for Zach's "approve this change?" card). */
export function weekChanges(before: Week | null, after: Week) {
  return WEEKDAYS.filter((d) => !before || ruleText(before[d]) !== ruleText(after[d])).map((d) => ({
    day: d,
    before: before ? ruleText(before[d]) : null,
    after: ruleText(after[d]),
  }));
}

/** The schedule in effect: the newest approved version. */
export function currentOf(rows: WeeklySchedule[]) {
  return (
    rows
      .filter((r) => r.status === "approved")
      .sort((a, b) => (a.decided_at ?? a.created_at).localeCompare(b.decided_at ?? b.created_at))
      .at(-1) ?? null
  );
}

/**
 * Does the regular schedule get in the way of a job on `date`, from `start` minutes to `end` minutes?
 * Returns null when it's fine.
 */
export function regularConflict(w: Week | undefined, date: string, start: number, end: number): { off: boolean; text: string } | null {
  if (!w) return null;
  const d = weekdayOf(date);
  const r = w[d];
  const day = WEEKDAY_LABEL[d];
  if (r.k === "off") return { off: true, text: `Off ${day}s (regular)` };
  if (r.k === "some") {
    const from = minutes(r.from);
    const until = minutes(r.until);
    if (until != null && until < end) return { off: false, text: `Off by ${fmtTime(r.until!)} ${day}s` };
    if (from != null && from > start) return { off: false, text: `Starts ${fmtTime(r.from!)} ${day}s` };
  }
  return null;
}
