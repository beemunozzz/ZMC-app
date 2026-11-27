// The low-hours alert for Zach: a full-time crew member with this many scheduled job hours or fewer
// in the current week. It shows on Zach's home screen from Wednesday until he taps "Got it".
import { ZMC_TZ } from "./dates";

export const ALERT_HOURS = 16;
/** 0 = Sunday ... 3 = Wednesday. The alert starts on this day of the week (Pacific time). */
export const ALERT_FROM_WEEKDAY = 3;

/** Today's weekday in Stockton (0 = Sunday). */
export function pacificWeekday(now = new Date()) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: ZMC_TZ, weekday: "short" }).format(now);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

/** Wednesday through Sunday. (Weeks start on Monday, so Sunday is the week's last day.) */
export const alertDay = (now = new Date()) => {
  const d = pacificWeekday(now);
  return d === 0 || d >= ALERT_FROM_WEEKDAY;
};

/** A full-time week, by scheduled job hours (Brandon, Nov 27): green 32+, orange 20 to 32, red under 20. */
export const FULL_WEEK_HOURS = 40;
export const GOOD_HOURS = 32;
export const LOW_HOURS = 20;

export type HoursBand = "full" | "light" | "low";
export const hoursBand = (h: number): HoursBand => (h >= GOOD_HOURS ? "full" : h >= LOW_HOURS ? "light" : "low");
export const BAND_LABEL: Record<HoursBand, string> = { full: "Full", light: "Light", low: "Low" };
/** Text color for an hours number. */
export const BAND_TEXT: Record<HoursBand, string> = { full: "text-ok", light: "text-warn", low: "text-bad" };
/** Bar color (filled). */
export const BAND_BAR: Record<HoursBand, string> = { full: "bg-ok", light: "bg-warn-fill", low: "bg-bad-fill" };
