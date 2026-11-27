// Date helpers. Dates are plain "YYYY-MM-DD" strings so they never shift with time zones.
export const ZMC_TZ = "America/Los_Angeles";

export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Today's date in Stockton. */
export function todayISO(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZMC_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function isISODate(s: string | undefined | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
}

function toDate(iso: string) {
  return new Date(iso + "T00:00:00Z");
}
function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number) {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}

/** Monday of the week that contains this date. */
export function mondayOf(iso: string) {
  const dow = (toDate(iso).getUTCDay() + 6) % 7; // Mon = 0
  return addDays(iso, -dow);
}

export function firstOfMonth(iso: string) {
  return iso.slice(0, 8) + "01";
}

export function addMonths(iso: string, n: number) {
  const d = toDate(firstOfMonth(iso));
  d.setUTCMonth(d.getUTCMonth() + n);
  return toISO(d);
}

export function lastOfMonth(iso: string) {
  return addDays(addMonths(iso, 1), -1);
}

export function dayOfMonth(iso: string) {
  return Number(iso.slice(8, 10));
}

function fmt(iso: string, opts: Intl.DateTimeFormatOptions) {
  return toDate(iso).toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
}

/** "Mon, Nov 24" */
export const fmtDay = (iso: string) => fmt(iso, { weekday: "short", month: "short", day: "numeric" });
/** "Monday, November 24" */
export const fmtDayLong = (iso: string) => fmt(iso, { weekday: "long", month: "long", day: "numeric" });
/** "Nov 24" */
export const fmtShort = (iso: string) => fmt(iso, { month: "short", day: "numeric" });
/** "November 2026" */
export const fmtMonth = (iso: string) => fmt(iso, { month: "long", year: "numeric" });

/** "08:30" -> minutes after midnight */
export function minutes(t: string | null | undefined) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** minutes -> "8:30 AM" */
export function fmtMinutes(total: number) {
  const m = ((Math.round(total) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${((h + 11) % 12) + 1}${mm ? ":" + String(mm).padStart(2, "0") : ""} ${h < 12 ? "AM" : "PM"}`;
}

/** "08:30:00" -> "8:30 AM" */
export function fmtTime(t: string | null | undefined) {
  const m = minutes(t);
  return m == null ? "" : fmtMinutes(m);
}

/** Hours like 2.5 -> "2.5", 3 -> "3" */
export const fmtHours = (h: number) => (Math.round(h * 10) / 10).toString();

/** The current time in milliseconds (server pages: "how long ago" labels). */
export const nowMs = () => Date.now();
