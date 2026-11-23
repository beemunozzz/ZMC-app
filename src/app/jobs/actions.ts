"use server";

import { redirect } from "next/navigation";
import { requireMember } from "@/lib/crew";
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
  };

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
