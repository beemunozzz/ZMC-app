// Quotes: types, labels and the reply text. Safe to use on the server and the phone.
import { fmtDayLong, fmtTime } from "./dates";
import type { House, Truck } from "./jobs";
import { REFER_ITEMS, money, priceQuote, type Prices } from "./pricing";

export type QuoteStatus = "new" | "quoted" | "booked" | "declined";

export type Quote = {
  id: string;
  status: QuoteStatus;
  customer_name: string;
  customer_phone: string;
  heard_from: string;
  move_date: string | null;
  start_time: string | null;
  job_type: string;
  pickup_address: string;
  pickup_house: House;
  dropoff_address: string;
  dropoff_house: House;
  size: string;
  heavy_items: string;
  notes: string;
  truck: Truck;
  movers: number;
  est_hours: number | null;
  miles_out: number | null;
  miles_between: number | null;
  miles_back: number | null;
  quote_total: number | null;
  nte: number | null;
  job_id: string | null;
  created_at: string;
};

export const QUOTE_COLUMNS =
  "id, status, customer_name, customer_phone, heard_from, move_date, start_time, job_type, pickup_address, pickup_house, dropoff_address, dropoff_house, size, heavy_items, notes, truck, movers, est_hours, miles_out, miles_between, miles_back, quote_total, nte, job_id, created_at";

export const QUOTE_STATUS: Record<QuoteStatus, { label: string; cls: string }> = {
  new: { label: "New", cls: "bg-warn/12 text-warn" },
  quoted: { label: "Quoted", cls: "bg-primary/10 text-primary" },
  booked: { label: "Booked", cls: "bg-ok/12 text-ok" },
  declined: { label: "Declined", cls: "bg-line text-muted" },
};

export const HEARD_FROM = [
  "Google",
  "Facebook",
  "A friend or family member",
  "A realtor",
  "A cleaning company",
  "Repeat customer",
  "Other",
];

/** The ready-to-send reply for the customer. */
export function quoteText(
  q: Pick<Quote, "customer_name" | "move_date" | "start_time" | "truck" | "heavy_items" | "movers" | "est_hours" | "miles_out" | "miles_between" | "miles_back" | "nte">,
  s: Prices,
) {
  const p = priceQuote(q, s);
  const first = q.customer_name.trim().split(/\s+/)[0] || "there";
  const when = q.move_date ? ` on ${fmtDayLong(q.move_date)}${q.start_time ? ` at ${fmtTime(q.start_time)}` : ""}` : "";
  const nte = Number(q.nte) || 0;
  return [
    `Hi ${first}, thanks for reaching out to Zachery's Moving Co.!`,
    `For your move${when}, we'd send ${p.movers} movers${q.truck === "theirs" ? "" : " with our truck"}.`,
    `Estimate: about ${p.hours} hours, ${money(p.total)} total.${nte ? ` Written not-to-exceed price: ${money(nte)}.` : ""}`,
    `We charge ${money(s.rate)} per mover per hour with a ${s.min_hours}-hour minimum.${
      REFER_ITEMS.test(q.heavy_items) ? " We don't move pianos or hot tubs ourselves, but we'll connect you with a specialist." : ""
    }`,
    `Reply YES to book, or call/text ${s.business_phone} with any questions.`,
  ].join("\n");
}
