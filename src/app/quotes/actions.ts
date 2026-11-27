"use server";

import { redirect } from "next/navigation";
import { requireMember } from "@/lib/crew";
import { isISODate } from "@/lib/dates";
import { HOUSE_FIELDS, JOB_TYPES, type House } from "@/lib/jobs";
import { flatRate, parseDrive, priceQuote, suggestedNte } from "@/lib/pricing";
import type { QuoteStatus } from "@/lib/quotes";
import { getOwnerCosts, getPrices } from "@/lib/settings";
import { truckCost, type TruckChoices } from "@/lib/truck-cost";

export type QuoteFormState = { error?: string; ok?: string };

const STATUSES: QuoteStatus[] = ["new", "contacted", "quoted", "follow_up", "booked", "lost", "declined"];

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
  let status = text(form, "status", 12) as QuoteStatus;
  const movers = Math.round(Number(text(form, "movers", 3) || 2));
  const est_hours = numOrNull(form, "est_hours");
  const miles_out = numOrNull(form, "miles_out");
  const miles_between = numOrNull(form, "miles_between");
  const miles_back = numOrNull(form, "miles_back");
  let nte = numOrNull(form, "nte");
  const driveOutRaw = text(form, "drive_out", 12);
  const driveBackRaw = text(form, "drive_back", 12);
  const drive_out_min = parseDrive(driveOutRaw);
  const drive_back_min = parseDrive(driveBackRaw);
  if (driveOutRaw && drive_out_min == null) return { error: "Drive time to the pickup: type minutes (45) or hours and minutes (1:30)." };
  if (driveBackRaw && drive_back_min == null) return { error: "Drive time back to the shop: type minutes (45) or hours and minutes (1:30)." };
  const pricing = text(form, "pricing", 8) === "flat" ? "flat" : "hourly";
  const rate_override = numOrNull(form, "rate_override");
  const truck_rate = numOrNull(form, "truck_rate");
  if (Number.isNaN(rate_override) || (rate_override != null && rate_override > 2000)) return { error: "The adjusted hourly rate doesn't look right." };
  if (Number.isNaN(truck_rate) || (truck_rate != null && truck_rate > 1000)) return { error: "The truck's hourly share doesn't look right." };
  // The owner's "Our truck cost" choices (owner-only; saved with the quote, never shown to customers).
  const tc: TruckChoices = {
    miles: Number(text(form, "tc_miles", 8)) || 0,
    days: Math.max(1, Math.round(Number(text(form, "tc_days", 3)) || 1)),
    type: text(form, "tc_type", 8) === "oneway" ? "oneway" : "round",
    oneway_price: Number(text(form, "tc_oneway", 10)) || 0,
    fuel: text(form, "tc_fuel", 10) === "diesel" ? "diesel" : "unleaded",
    follow_miles: Number(text(form, "tc_follow", 8)) || 0,
  };

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
  const inputs = { movers, est_hours, miles_out, miles_between, miles_back, truck, drive_out_min, drive_back_min, rate_override, truck_rate } as const;
  const price = priceQuote(inputs, prices);
  const costs = await getOwnerCosts(supabase);
  const flat = flatRate(inputs, prices, truck === "ours" ? truckCost({ ...tc, miles: tc.miles || price.truckMiles }, costs).total : 0, costs.flat_margin);
  const flat_price = pricing === "flat" ? flat.total : null;
  const total = pricing === "flat" ? flat.total : price.total;

  if (intent === "book") {
    if (!move_date) return { error: "Add a move date before booking." };
    if (nte == null) nte = pricing === "flat" ? flat.total : suggestedNte(inputs, prices);
    if (nte < total) return { error: "The not-to-exceed price is lower than the estimate. Raise it before booking." };
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
    quote_total: total,
    nte,
    drive_out_min,
    drive_back_min,
    pricing,
    flat_price,
    truck_cost: { ...tc, rate_mode: ["standard", "atCost", "manual"].includes(text(form, "rate_mode", 10)) ? text(form, "rate_mode", 10) : "standard" },
    rate_override: rate_override || null,
    truck_rate: truck === "ours" ? truck_rate || null : null,
    lost_reason: status === "lost" || status === "declined" ? text(form, "lost_reason", 60) : "",
    referred_by: text(form, "referred_by", 120),
    partner_id: /^[0-9a-f-]{36}$/i.test(text(form, "partner_id", 40)) ? text(form, "partner_id", 40) : null,
    // The first reply to the customer: anything past "New" counts.
    ...(status !== "new" ? { contacted_at: text(form, "contacted_at", 40) || new Date().toISOString() } : {}),
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
  // Copy the miles so the invoice can fill them in (ignored if the invoices setup hasn't run yet).
  // Copy the miles, drive times and any flat price so the invoice can use them.
  await supabase.from("jobs").update({ miles_out, miles_between, miles_back, drive_min: drive_out_min, drive_back_min, flat_price, rate_override: rate_override || null, truck_rate: truck === "ours" ? truck_rate || null : null }).eq("id", job.id);

  await supabase.from("quotes").update({ status: "booked", job_id: job.id }).eq("id", quoteId);
  redirect(`/jobs/${job.id}?booked=1`);
}

export async function deleteQuote(form: FormData) {
  const { supabase, me } = await requireMember();
  const id = String(form.get("id") ?? "");
  if (me?.role === "owner" && /^[0-9a-f-]{36}$/i.test(id)) await supabase.from("quotes").delete().eq("id", id);
  redirect("/quotes");
}
