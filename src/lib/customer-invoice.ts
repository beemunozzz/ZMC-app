// The customer's copy of an invoice: customer-facing numbers only, saved on the invoice when it's sent
// (and refreshed when the hours are changed). It must NEVER include our costs. Server only.
import type { SupabaseClient } from "@supabase/supabase-js";
import { niceName } from "./customer-quote";
import type { Invoice, PayMethod } from "./invoices";
import { houseLine, type House } from "./jobs";
import { priceInvoice, type Prices } from "./pricing";
import { getPrices } from "./settings";

export type InvoiceCustomerView = {
  number: string; // "INV-9A61"
  issued: string; // YYYY-MM-DD
  customer_name: string;
  customer_phone: string;
  move_date: string;
  start_time: string | null;
  job_type: string;
  pickup_address: string;
  pickup_house: string;
  dropoff_address: string;
  dropoff_house: string;
  movers: number;
  truck: "ours" | "theirs";
  pricing: "hourly" | "flat";
  hours: number;
  /** Hourly breakdown. When an old invoice doesn't match today's math, only the amounts are shown. */
  detail: boolean;
  hourly_rate: number;
  regular_hours: number;
  clock_amount: number;
  ot_hours: number;
  ot_rate: number;
  overtime_after: number;
  min_hours: number;
  travel_minutes: number;
  travel_free_hours: number;
  /** The saved amounts (what the customer owes). */
  labor: number;
  travel_amount: number;
  truck_charge: number;
  total: number;
  nte: number;
  business_phone: string;
  pay: { zelle: string; cashapp: string; venmo: string; apple_cash: string };
};

type JobBits = {
  job_date: string;
  start_time: string | null;
  job_type: string;
  pickup_address: string;
  pickup_house: House | null;
  dropoff_address: string;
  dropoff_house: House | null;
  drive_min: number | null;
  drive_back_min: number | null;
  flat_price: number | null;
  rate_override: number | null;
  truck_rate: number | null;
};

const JOB_BITS = "job_date, start_time, job_type, pickup_address, pickup_house, dropoff_address, dropoff_house, drive_min, drive_back_min, flat_price, rate_override, truck_rate";
const near = (a: number, b: number) => Math.abs(a - b) < 0.02;

export function buildInvoiceView(inv: Invoice, job: JobBits, s: Prices): InvoiceCustomerView {
  const flatPrice = job.flat_price != null && Number(job.flat_price) > 0 ? Number(job.flat_price) : null;
  const p = priceInvoice(
    {
      movers: inv.movers,
      est_hours: inv.hours,
      miles_out: inv.miles_out,
      miles_between: inv.miles_between,
      miles_back: inv.miles_back,
      truck: inv.truck,
      drive_out_min: job.drive_min,
      drive_back_min: job.drive_back_min,
      rate_override: job.rate_override,
      truck_rate: job.truck_rate,
    },
    s,
    flatPrice,
  );
  const flat = flatPrice != null && near(Number(inv.total), flatPrice);
  // Show the hours x rate breakdown only when it adds up to what was billed (old invoices used older prices).
  const detail = !flat && near(p.clock, Number(inv.labor)) && near(p.travel, Number(inv.trip)) && Number(inv.truck_charge) === 0;
  return {
    number: `INV-${inv.id.slice(0, 4).toUpperCase()}`,
    issued: inv.created_at.slice(0, 10),
    customer_name: niceName(inv.customer_name),
    customer_phone: inv.customer_phone,
    move_date: job.job_date,
    start_time: job.start_time,
    job_type: job.job_type,
    pickup_address: job.pickup_address,
    pickup_house: houseLine(job.pickup_house),
    dropoff_address: job.dropoff_address,
    dropoff_house: houseLine(job.dropoff_house),
    movers: inv.movers,
    truck: inv.truck,
    pricing: flat ? "flat" : "hourly",
    hours: Number(inv.hours),
    detail,
    hourly_rate: p.hourlyRate,
    regular_hours: p.regularHours,
    clock_amount: Math.round(p.hourlyRate * p.regularHours * 100) / 100,
    ot_hours: p.otHours,
    ot_rate: p.otRate,
    overtime_after: s.long_day_hours,
    min_hours: s.min_hours,
    travel_minutes: Math.round(p.travelHours * 60),
    travel_free_hours: s.travel_free_hours,
    labor: Number(inv.labor),
    travel_amount: Number(inv.trip),
    truck_charge: Number(inv.truck_charge),
    total: Number(inv.total),
    nte: Number(inv.nte),
    business_phone: s.business_phone,
    pay: { zelle: s.zelle, cashapp: s.cashapp, venmo: s.venmo, apple_cash: s.apple_cash },
  };
}

/** Rebuild and save the customer's copy (after sending, or after Zach changes the hours). */
export async function saveInvoiceView(supabase: SupabaseClient, inv: Invoice) {
  const [{ data: job }, prices] = await Promise.all([
    supabase.from("jobs").select(JOB_BITS).eq("id", inv.job_id).maybeSingle(),
    getPrices(supabase),
  ]);
  const fallback: JobBits = {
    job_date: inv.created_at.slice(0, 10), start_time: null, job_type: "Move", pickup_address: "", pickup_house: null,
    dropoff_address: "", dropoff_house: null, drive_min: null, drive_back_min: null, flat_price: null, rate_override: null, truck_rate: null,
  };
  const view = buildInvoiceView(inv, (job as JobBits | null) ?? fallback, prices);
  return supabase.from("invoices").update({ customer_view: view }).eq("id", inv.id);
}

export type InvoiceRow = {
  view: InvoiceCustomerView;
  paid_at: string | null;
  payment_method: PayMethod;
  signed_name: string | null;
  signature: string | null;
  signed_at: string | null;
  hours_verified_at: string | null;
};

/** How to pay, one line per option Zach has set up. Shared with the PDF. */
export function payLines(v: InvoiceCustomerView) {
  const lines: string[] = [];
  if (v.pay.zelle) lines.push(`Zelle: ${v.pay.zelle}`);
  if (v.pay.venmo) lines.push(`Venmo: @${v.pay.venmo.replace(/^@/, "")}`);
  if (v.pay.cashapp) lines.push(`Cash App: $${v.pay.cashapp.replace(/^\$/, "")}`);
  if (v.pay.apple_cash) lines.push(`Apple Cash: ${v.pay.apple_cash}`);
  lines.push("Cash, check (to Zachery's Moving Co.) or card");
  return lines;
}
