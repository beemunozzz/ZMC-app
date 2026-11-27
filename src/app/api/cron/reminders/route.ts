// The nightly "you have a job tomorrow" reminder. Vercel's free timer calls this once each evening
// (see vercel.json). It only works with the secret key (CRON_SECRET) that Vercel sends along.
import { createClient } from "@supabase/supabase-js";
import { fmtHours, fmtTime, mondayOf, todayISO } from "@/lib/dates";
import { ALERT_FROM_WEEKDAY, ALERT_HOURS, pacificWeekday } from "@/lib/hours-alert";
import { sendPush } from "@/lib/push";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

type Row = {
  crew_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  job_id: string;
  start_time: string | null;
  customer_name: string;
  pickup_address: string;
  is_lead: boolean;
};

export async function GET(request: Request) {
  const key = process.env.CRON_SECRET ?? "";
  if (!key || request.headers.get("authorization") !== `Bearer ${key}`) {
    return Response.json({ error: "Not allowed" }, { status: 401 });
  }

  const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const { data, error } = await db.rpc("reminder_targets", { p_key: key });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as Row[];
  // One notification per job per phone. Someone with two jobs tomorrow gets one for each.
  const sent = await sendPush(
    rows.map((r) => ({
      endpoint: r.endpoint,
      p256dh: r.p256dh,
      auth: r.auth,
      msg: {
        title: `Tomorrow${r.start_time ? ` at ${fmtTime(r.start_time)}` : ""}${r.is_lead ? " · you lead" : ""}`,
        body: `${r.customer_name} · ${r.pickup_address || "address in the app"}`,
        url: `/jobs/${r.job_id}`,
        tag: `remind-${r.job_id}`,
      },
    })),
  );

  // Wednesday evening: tell Zach which full-time crew are low on hours this week (until he taps "Got it").
  let lowSent = 0;
  if (pacificWeekday() === ALERT_FROM_WEEKDAY) {
    const [{ data: low }, { data: owners }] = await Promise.all([
      db.rpc("low_hours_targets", { p_key: key, p_week: mondayOf(todayISO()), p_max: ALERT_HOURS }),
      db.rpc("owner_push_targets", { p_key: key }),
    ]);
    const people = (low ?? []) as { full_name: string; hours: number }[];
    if (people.length && owners?.length) {
      lowSent = await sendPush(
        (owners as { endpoint: string; p256dh: string; auth: string }[]).map((o) => ({
          ...o,
          msg: {
            title: `Low on hours this week (${people.length})`,
            body: people.map((p) => `${p.full_name.split(" ")[0]} ${fmtHours(Number(p.hours))} hrs`).join(" · "),
            url: "/",
            tag: `low-hours-${mondayOf(todayISO())}`,
          },
        })),
      );
    }
  }
  return Response.json({ jobs: new Set(rows.map((r) => r.job_id)).size, sent, lowSent });
}
