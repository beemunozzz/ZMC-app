// The nightly "you have a job tomorrow" reminder. Vercel's free timer calls this once each evening
// (see vercel.json). It only works with the secret key (CRON_SECRET) that Vercel sends along.
import { createClient } from "@supabase/supabase-js";
import { addDays, fmtDay, fmtHours, fmtTime, mondayOf, todayISO } from "@/lib/dates";
import { ALERT_FROM_WEEKDAY, ALERT_HOURS, pacificWeekday } from "@/lib/hours-alert";
import { sendPush } from "@/lib/push";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { jobForecast, stocktonForecast } from "@/lib/weather";
import { WX_EMOJI, WX_TIP, WX_WATCH, wxChip, type JobWx } from "@/lib/weather-kinds";

type WxJob = { id: string; job_date: string; customer_name: string; pickup_address: string; dropoff_address: string; lead_id: string | null; wx_kind: string | null; wx_where: string | null };
type Target = { endpoint: string; p256dh: string; auth: string };

/** "Rain in Livermore: bring extra blankets, plastic covers and floor runners." */
const wxLine = (w: JobWx) => `${WX_EMOJI[w.kind]} ${wxChip(w)}${WX_TIP[w.kind] ? `: ${WX_TIP[w.kind]!.split(": ").slice(1).join(": ") || WX_TIP[w.kind]}` : "."}`;

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

  // Weather for the next 2 days' jobs: pickup, the drive and drop-off (best-effort; never stops the reminders).
  const today = todayISO();
  const tomorrow = addDays(today, 1);
  const { data: wxRows } = await db.rpc("weather_jobs", { p_key: key, p_from: tomorrow, p_to: addDays(today, 2) });
  const wxJobs = (wxRows ?? []) as WxJob[];
  const stockton = await stocktonForecast();
  const wx = new Map<string, JobWx>(); // jobs with weather worth a warning
  const checked = new Set<string>(); // jobs we actually got a forecast for (the weather service can be down)
  await Promise.all(
    wxJobs.map(async (j) => {
      const w = await jobForecast(j, stockton).catch(() => null);
      if (!w) return;
      checked.add(j.id);
      if (WX_WATCH.includes(w.kind)) wx.set(j.id, w);
    }),
  );

  // One notification per job per phone. Someone with two jobs tomorrow gets one for each.
  const sent = await sendPush(
    rows.map((r) => ({
      endpoint: r.endpoint,
      p256dh: r.p256dh,
      auth: r.auth,
      msg: {
        title: `Tomorrow${r.start_time ? ` at ${fmtTime(r.start_time)}` : ""}${r.is_lead ? " · you lead" : ""}`,
        body: `${r.customer_name} · ${r.pickup_address || "address in the app"}${wx.has(r.job_id) ? `\n${wxLine(wx.get(r.job_id)!)}` : ""}`,
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

  // Weather heads-up: when a job's weather turns bad (or moves somewhere else), tell Zach and the job's lead once.
  // The lead isn't told separately for tomorrow's jobs: their reminder above already has the weather.
  let wxSent = 0;
  const changed = wxJobs.filter((j) => {
    if (!checked.has(j.id)) return false;
    const w = wx.get(j.id);
    return (w?.kind ?? null) !== j.wx_kind || (w?.where ?? null) !== (j.wx_where ?? null);
  });
  if (changed.length) {
    const leads = [...new Set(changed.filter((j) => j.lead_id && j.job_date !== tomorrow && wx.has(j.id)).map((j) => j.lead_id!))];
    const [{ data: owners }, { data: leadPhones }] = await Promise.all([
      db.rpc("owner_push_targets", { p_key: key }),
      leads.length ? db.rpc("crew_push_targets", { p_key: key, p_crew: leads }) : Promise.resolve({ data: [] }),
    ]);
    for (const j of changed) {
      const w = wx.get(j.id);
      await db.rpc("set_job_wx", { p_key: key, p_job: j.id, p_kind: w?.kind ?? null, p_where: w?.where ?? null });
      if (!w) continue; // the weather got better: just remember it
      const to: Target[] = [
        ...((owners ?? []) as Target[]),
        ...(j.lead_id && j.job_date !== tomorrow ? ((leadPhones ?? []) as (Target & { crew_id: string })[]).filter((p) => p.crew_id === j.lead_id) : []),
      ];
      wxSent += await sendPush(
        to.map((t) => ({
          endpoint: t.endpoint,
          p256dh: t.p256dh,
          auth: t.auth,
          msg: {
            title: `Weather heads-up · ${j.job_date === tomorrow ? "Tomorrow" : fmtDay(j.job_date)}`,
            body: `${j.customer_name}: ${wxLine(w)}`,
            url: `/jobs/${j.id}`,
            tag: `wx-${j.id}`,
          },
        })),
      );
    }
  }
  return Response.json({ jobs: new Set(rows.map((r) => r.job_id)).size, sent, lowSent, wxJobs: wxJobs.length, wxChanged: changed.length, wxSent });
}
