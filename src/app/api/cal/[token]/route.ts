// A crew member's private calendar link. Their phone's calendar app checks it every few hours,
// so new and changed jobs show up in their own calendar. No login: the long code in the link is the key.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

type Row = {
  id: string;
  job_date: string;
  start_time: string | null;
  est_hours: number | null;
  status: string;
  job_type: string;
  customer_name: string;
  pickup_address: string;
  dropoff_address: string;
  is_lead: boolean;
  crew_names: string | null;
};

// Calendar text needs commas, semicolons and new lines escaped.
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
// Long lines are folded at 75 characters.
const fold = (line: string) => line.match(/.{1,73}/g)!.join("\r\n ");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function event(j: Row, now: string) {
  const date = j.job_date.replace(/-/g, "");
  const lines = [`UID:${j.id}@zmc-hub`, `DTSTAMP:${now}`];
  if (j.start_time) {
    const [h, m] = j.start_time.split(":").map(Number);
    const startMin = h * 60 + m;
    const endMin = startMin + Math.round((Number(j.est_hours) || 2) * 60);
    const t = (mins: number) => `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}${String(mins % 60).padStart(2, "0")}00`;
    lines.push(`DTSTART;TZID=America/Los_Angeles:${date}T${t(startMin)}`, `DTEND;TZID=America/Los_Angeles:${date}T${t(Math.min(endMin, 23 * 60 + 59))}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${date}`);
  }
  const desc = [
    j.job_type,
    j.is_lead ? "You're the crew lead." : "",
    j.crew_names ? `Crew: ${j.crew_names}` : "",
    j.dropoff_address ? `Drop-off: ${j.dropoff_address}` : "",
    "Details in ZMC Hub: https://zmc-app.vercel.app/jobs/" + j.id,
  ].filter(Boolean);
  lines.push(
    `SUMMARY:${esc(`ZMC: ${j.customer_name}${j.is_lead ? " (lead)" : ""}`)}`,
    `LOCATION:${esc(j.pickup_address || "")}`,
    `DESCRIPTION:${esc(desc.join("\n"))}`,
    `URL:https://zmc-app.vercel.app/jobs/${j.id}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:ZMC job in 1 hour",
    "END:VALARM",
  );
  return ["BEGIN:VEVENT", ...lines, "END:VEVENT"].map(fold).join("\r\n");
}

export async function GET(_request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const code = token.replace(/\.ics$/, "");
  if (!/^[0-9a-f]{40,80}$/.test(code)) return new Response("Not found", { status: 404 });

  const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const { data, error } = await db.rpc("calendar_jobs", { p_token: code });
  if (error) return new Response("Calendar not available", { status: 500 });

  const now = stamp(new Date());
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ZMC Hub//Jobs//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:ZMC jobs",
    "X-WR-TIMEZONE:America/Los_Angeles",
    "REFRESH-INTERVAL;VALUE=DURATION:PT2H",
    "X-PUBLISHED-TTL:PT2H",
    // Pacific time, so times are right whatever time zone the phone is in.
    "BEGIN:VTIMEZONE",
    "TZID:America/Los_Angeles",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:-0800",
    "TZOFFSETTO:-0700",
    "TZNAME:PDT",
    "DTSTART:19700308T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:-0700",
    "TZOFFSETTO:-0800",
    "TZNAME:PST",
    "DTSTART:19701101T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
    "END:STANDARD",
    "END:VTIMEZONE",
    ...((data ?? []) as Row[]).map((j) => event(j, now)),
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(body + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="zmc-jobs.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
