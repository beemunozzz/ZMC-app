// The customer's copy of a quote: a frozen snapshot of customer-facing numbers, made when Zach sends the link.
// It must NEVER include our costs (truck cost, materials, margin, profit). Safe on the server and the phone.
import { houseLine } from "./jobs";
import { priceQuote, REFER_ITEMS, type Prices } from "./pricing";
import type { Quote } from "./quotes";

export type CustomerView = {
  number: string; // "Q-9A61"
  issued: string; // YYYY-MM-DD
  valid_until: string; // YYYY-MM-DD
  customer_name: string;
  customer_phone: string;
  move_date: string | null;
  start_time: string | null;
  job_type: string;
  pickup_address: string;
  pickup_house: string;
  dropoff_address: string;
  dropoff_house: string;
  movers: number;
  truck: "ours" | "theirs";
  pricing: "hourly" | "flat";
  hourly_rate: number;
  hours: number;
  regular_hours: number;
  clock_amount: number;
  ot_hours: number;
  ot_rate: number;
  overtime_after: number;
  min_hours: number;
  travel_minutes: number;
  travel_amount: number;
  travel_free_hours: number;
  total: number;
  nte: number;
  flat_price: number | null;
  refer: boolean;
  business_phone: string;
  /** Zach's short cancellation policy (blank = not shown). */
  cancellation_policy?: string;
};

const VALID_DAYS = 14;

/** "Brandon Mathew Munoz" from "BRANDON MATHEW MUNOZ" (leaves mixed case alone). */
export const niceName = (s: string) => (s === s.toUpperCase() ? s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : s).trim();

export function buildCustomerView(q: Quote, s: Prices, today: string): CustomerView {
  const p = priceQuote(q, s);
  const flat = q.pricing === "flat" && Number(q.flat_price) > 0 ? Number(q.flat_price) : null;
  const valid = new Date(today + "T00:00:00Z");
  valid.setUTCDate(valid.getUTCDate() + VALID_DAYS);
  return {
    number: `Q-${q.id.slice(0, 4).toUpperCase()}`,
    issued: today,
    valid_until: valid.toISOString().slice(0, 10),
    customer_name: niceName(q.customer_name),
    customer_phone: q.customer_phone,
    move_date: q.move_date,
    start_time: q.start_time,
    job_type: q.job_type,
    pickup_address: q.pickup_address,
    pickup_house: houseLine(q.pickup_house),
    dropoff_address: q.dropoff_address,
    dropoff_house: houseLine(q.dropoff_house),
    movers: p.movers,
    truck: q.truck,
    pricing: flat ? "flat" : "hourly",
    hourly_rate: p.hourlyRate,
    hours: p.hours,
    regular_hours: p.regularHours,
    clock_amount: Math.round(p.hourlyRate * p.regularHours * 100) / 100,
    ot_hours: p.otHours,
    ot_rate: p.otRate,
    overtime_after: s.long_day_hours,
    min_hours: s.min_hours,
    travel_minutes: Math.round(p.travelHours * 60),
    travel_amount: p.travel,
    travel_free_hours: s.travel_free_hours,
    total: flat ?? p.total,
    nte: Number(q.nte) || flat || p.total,
    flat_price: flat,
    refer: REFER_ITEMS.test(q.heavy_items),
    business_phone: s.business_phone,
    cancellation_policy: s.cancellation_policy || "",
  };
}
