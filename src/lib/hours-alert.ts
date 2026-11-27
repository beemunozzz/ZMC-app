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
