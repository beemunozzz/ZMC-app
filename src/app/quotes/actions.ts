"use server";

import { redirect } from "next/navigation";
import { requireMember } from "@/lib/crew";
import { isISODate } from "@/lib/dates";
import { HOUSE_FIELDS, JOB_TYPES, type House } from "@/lib/jobs";
import { priceQuote, suggestedNte } from "@/lib/pricing";
import type { QuoteStatus } from "@/lib/quotes";
import { getPrices } from "@/lib/settings";

export type QuoteFormState = { error?: string; ok?: string };

const STATUSES: QuoteStatus[] = ["new", "quoted", "booked", "declined"];

const text = (form: FormData, key: string, max = 500) => String(form.get(key) ?? "").trim().slice(0, max);
function numOrNull(form: FormData, key: string) {
  const raw = text(form, key, 12);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}
function house(form: FormData, prefix: string): House {
  const h: House = {};
  for (const f of HOUSE_FIELDS) {
    const v = text(form, `${prefix}_${f.key}`, 40);
    if (v) h[f.key] = v;
  }
  return h;
}

export async function saveQuote(_: QuoteFormState, form: FormData): Promise<QuoteFormState> {
  const { supabase, me } = await requireMember();
  if (me?.role !== "owner") return { error: "Only the owner can work on quotes." };

  const id = text(form, "id", 40);
  const intent = text(form, "intent", 10);
  const customer_name = text(form, "customer_name", 120);
  const move_date = text(form, "move_date", 10) || null;
  const job_type = text(form, "job_type", 40);
  const truck = text(form, "truck", 10) === "theirs" ? "theirs" : "ours";
  let status = text(form, "status", 10) as QuoteStatus;
  const movers = Math.round(Number(text(form, "movers", 3) || 2));
  const est_hours = numOrNull(form, "est_hours");
  const miles_out = numOrNull(form, "miles_out");
  const miles_between = numOrNull(form, "miles_between");
  const miles_back = numOrNull(form, "miles_back");
  let nte = numOrNull(form, "nte");

  if (!customer_name) return { error: "Add the customer's name." };
  if (move_date && !isISODate(move_date)) return { error: "That move date doesn't look right." };
  if (!JOB_TYPES.includes(job_type)) return { error: "Pick a type of job." };
  if (!STATUSES.includes(status)) return { error: "Pick a status." };
  if (!(movers >= 1 && movers <= 12)) return { error: "Movers should be between 1 and 12." };
  for (const [v, name] of [
    [est_hours, "Hours"],
    [miles_out, "Miles to pickup"],
    [miles_between, "Miles between"],
    [miles_back, "Miles back"],
    [nte, "Not-to-exceed price"],
  ] as const) {
    if (Number.isNaN(v)) return { error: `${name} should be a number.` };
  }

  const prices = await getPrices(supabase);
  const inputs = { movers, est_hours, miles_out, miles_between, miles_back, truck } as const;
  const price = priceQuote(inputs, prices);

  if (intent === "book") {
    if (!move_date) return { error: "Add a move date before booking." };
    if (nte == null) nte = suggestedNte(inputs, prices);
    if (nte < price.total) return { error: "The not-to-exceed price is lower than the estimate. Raise it before booking." };
    status = "booked";
  }

  const row = {
    status,
    customer_name,
    customer_phone: text(form, "customer_phone", 40),
    heard_from: text(form, "heard_from", 60),
    move_date,
    start_time: text(form, "start_time", 8) || null,
    job_type,
    pickup_address: text(form, "pickup_address", 300),
    pickup_house: house(form, "pickup"),
    dropoff_address: text(form, "dropoff_address", 300),
    dropoff_house: house(form, "dropoff"),
    size: text(form, "size", 200),
    heavy_items: text(form, "heavy_items", 500),
    notes: text(form, "notes", 4000),
    truck,
    movers,
    est_hours,
    miles_out,
    miles_between,
    miles_back,
    quote_total: price.total,
    nte,
  };

  let quoteId = id;
  if (id) {
    const { error } = await supabase.from("quotes").update(row).eq("id", id);
    if (error) return { error: `Couldn't save: ${error.message}` };
  } else {
    const { data, error } = await supabase.from("quotes").insert(row).select("id").single();
    if (error) return { error: `Couldn't save: ${error.message}` };
    quoteId = data.id;
  }

  if (intent !== "book") {
    if (!id) redirect(`/quotes/${quoteId}?saved=1`);
    return { ok: "Saved." };
  }

  // Book it: make the job, then link the quote to it.
  const { data: existing } = await supabase.from("quotes").select("job_id").eq("id", quoteId).single();
  if (existing?.job_id) redirect(`/jobs/${existing.job_id}`);

  const notes = [row.size && `Size: ${row.size}`, row.notes].filter(Boolean).join("\n");
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      job_date: move_date,
      start_time: row.start_time,
      est_hours: price.hours,
      pickup_address: row.pickup_address,
      pickup_house: row.pickup_house,
      dropoff_address: row.dropoff_address,
      dropoff_house: row.dropoff_house,
      customer_name,
      customer_phone: row.customer_phone,
      job_type,
      truck,
      status: "booked",
      movers_needed: price.movers,
      heavy_items: row.heavy_items,
      notes,
      nte,
      quote_id: quoteId,
    })
    .select("id")
    .single();
  if (jobError) return { error: `The quote saved, but the job couldn't be made: ${jobError.message}` };

  await supabase.from("quotes").update({ status: "booked", job_id: job.id }).eq("id", quoteId);
  redirect(`/jobs/${job.id}?booked=1`);
}

export async function deleteQuote(form: FormData) {
  const { supabase, me } = await requireMember();
  const id = String(form.get("id") ?? "");
  if (me?.role === "owner" && /^[0-9a-f-]{36}$/i.test(id)) await supabase.from("quotes").delete().eq("id", id);
  redirect("/quotes");
}
