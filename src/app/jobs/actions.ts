"use server";

import { redirect } from "next/navigation";
import { requireMember } from "@/lib/crew";
import { notify } from "@/lib/push";
import { fmtDay, fmtTime } from "@/lib/dates";
import { isISODate } from "@/lib/dates";
import { HOUSE_FIELDS, JOB_TYPES, type House, type JobStatus, type Truck } from "@/lib/jobs";

export type JobFormState = { error?: string };

const STATUSES: JobStatus[] = ["booked", "confirmed", "done", "canceled"];
const UUID = /^[0-9a-f-]{36}$/i;

function text(form: FormData, key: string, max = 500) {
  return String(form.get(key) ?? "").trim().slice(0, max);
}

function house(form: FormData, prefix: string): House {
  const h: House = {};
  for (const f of HOUSE_FIELDS) {
    const v = text(form, `${prefix}_${f.key}`, 40);
    if (v) h[f.key] = v;
  }
  return h;
}

export async function saveJob(_: JobFormState, form: FormData): Promise<JobFormState> {
  const { supabase, me } = await requireMember();
  if (me?.role !== "owner") return { error: "Only the owner can add or change jobs." };

  const id = text(form, "id", 40);
  const job_date = text(form, "job_date", 10);
  const start_time = text(form, "start_time", 8) || null;
  const hoursRaw = text(form, "est_hours", 6);
  const est_hours = hoursRaw ? Number(hoursRaw) : null;
  const customer_name = text(form, "customer_name", 120);
  const job_type = text(form, "job_type", 40);
  const truck = text(form, "truck", 10) as Truck;
  const status = text(form, "status", 10) as JobStatus;
  const movers_needed = Number(text(form, "movers_needed", 3) || 2);
  const leadRaw = text(form, "lead_id", 40);
  const lead_id = UUID.test(leadRaw) ? leadRaw : null;
  const crew_ids = form
    .getAll("crew_ids")
    .map(String)
    .filter((c) => UUID.test(c) && c !== lead_id);

  const nteRaw = text(form, "nte", 12);
  const nte = nteRaw ? Number(nteRaw) : null;
  if (nte != null && (!Number.isFinite(nte) || nte < 0)) return { error: "The not-to-exceed price should be a dollar amount." };
  const meet_at = text(form, "meet_at", 5) === "site" ? "site" : "shop";
  const driveRaw = text(form, "drive_min", 4);
  const drive_min = driveRaw ? Number(driveRaw) : null;
  if (drive_min != null && (!Number.isInteger(drive_min) || drive_min < 0 || drive_min > 600)) return { error: "Drive time should be whole minutes (0 to 600)." };
  if (!isISODate(job_date)) return { error: "Pick a date." };
  if (!customer_name) return { error: "Add the customer's name." };
  if (est_hours != null && (!Number.isFinite(est_hours) || est_hours < 0 || est_hours > 24))
    return { error: "Estimated hours should be a number between 0 and 24." };
  if (!JOB_TYPES.includes(job_type)) return { error: "Pick a type of job." };
  if (truck !== "ours" && truck !== "theirs") return { error: "Pick who brings the truck." };
  if (!STATUSES.includes(status)) return { error: "Pick a status." };
  if (!Number.isInteger(movers_needed) || movers_needed < 1 || movers_needed > 12)
    return { error: "Movers needed should be between 1 and 12." };

  const row = {
    job_date,
    start_time,
    est_hours,
    pickup_address: text(form, "pickup_address", 300),
    pickup_house: house(form, "pickup"),
    dropoff_address: text(form, "dropoff_address", 300),
    dropoff_house: house(form, "dropoff"),
    customer_name,
    customer_phone: text(form, "customer_phone", 40),
    job_type,
    truck,
    status,
    movers_needed,
    lead_id,
    crew_ids,
    heavy_items: text(form, "heavy_items", 500),
    notes: text(form, "notes", 4000),
    nte,
    meet_at,
    drive_min,
    load_extra: String(form.get("load_extra") ?? "").split(/\r?\n/).map((l) => l.trim().slice(0, 80)).filter(Boolean).slice(0, 20).join("\n"),
  };

  // Who to tell: compare the crew and the time before and after saving.
  const newCrew = [lead_id, ...crew_ids].filter(Boolean) as string[];
  type Before = { lead_id: string | null; crew_ids: string[]; job_date: string; start_time: string | null; status: string };
  let before: Before | null = null;
  if (id) {
    const { data } = await supabase.from("jobs").select("lead_id, crew_ids, job_date, start_time, status").eq("id", id).maybeSingle();
    before = (data as Before | null) ?? null;
  }

  let savedId = id;
  if (id) {
    const { error } = await supabase.from("jobs").update(row).eq("id", id);
    if (error) return { error: `Couldn't save: ${error.message}` };
    // Anyone who said "can't make it" and is no longer on the job: their request is handled.
    const onJob = [lead_id, ...crew_ids].filter(Boolean) as string[];
    let q = supabase.from("cover_requests").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("job_id", id).eq("status", "open");
    if (onJob.length) q = q.not("crew_id", "in", `(${onJob.join(",")})`);
    await q;
  } else {
    const { data, error } = await supabase.from("jobs").insert(row).select("id").single();
    if (error) return { error: `Couldn't save: ${error.message}` };
    savedId = data.id;
  }

  // Phone notifications (best-effort; never blocks saving).
  const oldCrew = before ? ([before.lead_id, ...(before.crew_ids ?? [])].filter(Boolean) as string[]) : [];
  const when = `${fmtDay(job_date)}${start_time ? ` · ${fmtTime(start_time)}` : ""}`;
  const url = `/jobs/${savedId}`;
  const notMe = (ids: string[]) => ids.filter((c) => c !== me.id);
  const added = notMe(newCrew.filter((c) => !oldCrew.includes(c)));
  const removed = notMe(oldCrew.filter((c) => !newCrew.includes(c)));
  const stayed = notMe(newCrew.filter((c) => oldCrew.includes(c)));
  const moved = !!before && (before.job_date !== job_date || (before.start_time ?? "").slice(0, 5) !== (start_time ?? "").slice(0, 5));
  const canceled = !!before && before.status !== "canceled" && status === "canceled";
  if (status !== "canceled" && added.length)
    await notify(supabase, { crew: added }, { title: "New job", body: `${when} · ${row.job_type} · ${customer_name}`, url, tag: `job-${savedId}` });
  if (removed.length)
    await notify(supabase, { crew: removed }, { title: "Taken off a job", body: `You're no longer on ${customer_name} (${fmtDay(before!.job_date)}).`, url: "/", tag: `job-${savedId}` });
  if (canceled && stayed.length)
    await notify(supabase, { crew: stayed }, { title: "Job canceled", body: `${customer_name} on ${fmtDay(job_date)} is canceled.`, url, tag: `job-${savedId}` });
  else if (moved && stayed.length)
    await notify(supabase, { crew: stayed }, {
      title: "Your job changed",
      body: `${customer_name}: now ${when} (was ${fmtDay(before!.job_date)}${before!.start_time ? ` · ${fmtTime(before!.start_time)}` : ""}).`,
      url,
      tag: `job-${savedId}`,
    });

  redirect(`/jobs/${savedId}?saved=1`);
}

export async function deleteJob(form: FormData) {
  const { supabase, me } = await requireMember();
  const id = String(form.get("id") ?? "");
  const date = String(form.get("job_date") ?? "");
  if (me?.role !== "owner" || !UUID.test(id)) redirect("/");
  await supabase.from("jobs").delete().eq("id", id);
  redirect(isISODate(date) ? `/schedule?view=week&date=${date}` : "/schedule");
}

/** Remember that the day-before reminder was sent (owner only). */
export async function markReminderSent(id: string) {
  const { supabase, me } = await requireMember();
  if (me?.role !== "owner" || !UUID.test(id)) return;
  await supabase.from("jobs").update({ reminder_sent_at: new Date().toISOString() }).eq("id", id);
}
