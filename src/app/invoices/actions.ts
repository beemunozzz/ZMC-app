"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/crew";
import type { PayMethod } from "@/lib/invoices";
import { priceInvoice } from "@/lib/pricing";
import { getPrices } from "@/lib/settings";

export type InvoiceFormState = { error?: string };

const METHODS: PayMethod[] = ["cash", "check", "zelle", "card", "apple_pay", "cashapp", "venmo"];
const UUID = /^[0-9a-f-]{36}$/i;
const text = (form: FormData, key: string, max = 200) => String(form.get(key) ?? "").trim().slice(0, max);
const num = (form: FormData, key: string) => {
  const raw = text(form, key, 12);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

export async function createInvoice(_: InvoiceFormState, form: FormData): Promise<InvoiceFormState> {
  const { supabase, me } = await requireMember();
  if (!me) return { error: "Your account isn't active." };

  const jobId = text(form, "job_id", 40);
  if (!UUID.test(jobId)) return { error: "Job not found." };
  const { data: job } = await supabase.from("jobs").select("id, lead_id, customer_name, customer_phone, nte, status, drive_min, drive_back_min, flat_price, rate_override, truck_rate").eq("id", jobId).maybeSingle();
  if (!job) return { error: "Job not found." };
  if (me.role !== "owner" && job.lead_id !== me.id) return { error: "Only Zach or this job's crew lead can invoice it." };
  if (job.status === "canceled") return { error: "This job is canceled." };

  const hours = num(form, "hours");
  const movers = Math.round(Number(text(form, "movers", 3)));
  const truck = text(form, "truck", 10) === "theirs" ? "theirs" : "ours";
  const miles_out = num(form, "miles_out");
  const miles_between = num(form, "miles_between");
  const miles_back = num(form, "miles_back");
  const nteIn = job.nte != null ? Number(job.nte) : num(form, "nte");
  const signature = String(form.get("signature") ?? "");
  const signed_name = text(form, "signed_name", 120);
  const method = text(form, "payment_method", 12) as PayMethod;

  if (hours == null || Number.isNaN(hours) || hours <= 0 || hours > 24) return { error: "Enter the hours worked (more than 0)." };
  if (!(movers >= 1 && movers <= 12)) return { error: "Movers should be between 1 and 12." };
  for (const [v, n] of [[miles_out, "Miles to pickup"], [miles_between, "Miles between"], [miles_back, "Miles back"]] as const)
    if (Number.isNaN(v)) return { error: `${n} should be a number.` };
  if (nteIn == null || Number.isNaN(nteIn) || nteIn <= 0) return { error: "Enter the written not-to-exceed price the customer was given." };
  if (form.get("verified") !== "1") return { error: "The customer needs to tap “I verify these hours”." };
  // Signing is optional. If they signed, we need their printed name and "I agree".
  const signed = signature.startsWith("data:image/png;base64,") && signature.length >= 1500;
  if (signed && signature.length > 600_000) return { error: "That signature is too large. Clear it and sign again." };
  if (signed && !signed_name) return { error: "Type the customer's printed name next to their signature." };
  if (signed && form.get("agree") !== "on") return { error: "The customer signed, so they also need to tick “I agree”." };
  if (!METHODS.includes(method)) return { error: "Pick how the customer is paying." };

  const prices = await getPrices(supabase);
  const p = priceInvoice(
    { movers, est_hours: hours, miles_out, miles_between, miles_back, truck, drive_out_min: job.drive_min, drive_back_min: job.drive_back_min, rate_override: job.rate_override, truck_rate: job.truck_rate },
    prices,
    job.flat_price != null ? Number(job.flat_price) : null,
  );
  if (p.total > nteIn) {
    return { error: `The total (${p.total.toFixed(2)}) is over the not-to-exceed price (${nteIn.toFixed(2)}). By law the bill can't go over it. Lower the hours or charges.` };
  }

  const { data: inv, error } = await supabase
    .from("invoices")
    .insert({
      job_id: jobId,
      customer_name: job.customer_name,
      customer_phone: job.customer_phone,
      hours: p.hours,
      movers: p.movers,
      truck,
      miles_out,
      miles_between,
      miles_back,
      labor: p.labor,
      trip: p.trip,
      truck_charge: p.truck,
      total: p.total,
      nte: nteIn,
      signature: signed ? signature : null,
      signed_name: signed ? signed_name : null,
      signed_at: signed ? new Date().toISOString() : null,
      hours_verified_at: new Date().toISOString(),
      verified_hours: p.hours,
      verified_movers: p.movers,
      payment_method: method,
      created_by: me.id,
    })
    .select("id")
    .single();
  if (error) {
    if (error.message.includes("duplicate") || error.message.includes("unique")) {
      const { data: existing } = await supabase.from("invoices").select("id").eq("job_id", jobId).maybeSingle();
      if (existing) redirect(`/invoices/${existing.id}`);
      return { error: "This job already has an invoice." };
    }
    if (error.message.includes("relation") || error.message.includes("does not exist"))
      return { error: "Invoices aren't set up yet. Brandon needs to run the invoices setup in Supabase." };
    return { error: `Couldn't save: ${error.message}` };
  }
  redirect(`/invoices/${inv.id}?new=1`);
}

export async function markPaid(form: FormData) {
  const { supabase, me } = await requireMember();
  const id = String(form.get("id") ?? "");
  const undo = form.get("undo") === "1";
  if (!me || !UUID.test(id)) return;
  await supabase.from("invoices").update({ paid_at: undo ? null : new Date().toISOString() }).eq("id", id);
  revalidatePath(`/invoices/${id}`);
}

export async function changeMethod(form: FormData) {
  const { supabase, me } = await requireMember();
  const id = String(form.get("id") ?? "");
  const method = String(form.get("payment_method") ?? "") as PayMethod;
  if (!me || !UUID.test(id) || !METHODS.includes(method)) return;
  await supabase.from("invoices").update({ payment_method: method }).eq("id", id).is("paid_at", null);
  revalidatePath(`/invoices/${id}`);
}

/** Owner only: change the hours (and movers) after the customer verified them. The database also enforces this. */
export async function ownerEditHours(_: InvoiceFormState, form: FormData): Promise<InvoiceFormState> {
  const { supabase, me } = await requireMember();
  if (me?.role !== "owner") return { error: "Only Zach can change the hours after the customer verified them." };
  const id = text(form, "id", 40);
  const hours = num(form, "hours");
  const movers = Math.round(Number(text(form, "movers", 3)));
  if (!UUID.test(id)) return { error: "Invoice not found." };
  if (hours == null || Number.isNaN(hours) || hours <= 0 || hours > 24) return { error: "Enter the hours (more than 0)." };
  if (!(movers >= 1 && movers <= 12)) return { error: "Movers should be between 1 and 12." };

  const { data: inv } = await supabase.from("invoices").select("truck, miles_out, miles_between, miles_back, nte").eq("id", id).maybeSingle();
  if (!inv) return { error: "Invoice not found." };
  const prices = await getPrices(supabase);
  const p = priceInvoice({ movers, est_hours: hours, miles_out: inv.miles_out, miles_between: inv.miles_between, miles_back: inv.miles_back, truck: inv.truck }, prices);
  if (p.total > Number(inv.nte)) return { error: `That makes the total ${p.total.toFixed(2)}, over the not-to-exceed price of ${Number(inv.nte).toFixed(2)}.` };

  const { error } = await supabase
    .from("invoices")
    .update({ hours: p.hours, movers: p.movers, labor: p.labor, trip: p.trip, truck_charge: p.truck, total: p.total })
    .eq("id", id);
  if (error) return { error: `Couldn't save: ${error.message}` };
  revalidatePath(`/invoices/${id}`);
  return {};
}
