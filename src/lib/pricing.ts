// ZMC pricing rules (Dec 2026). Every number comes from the Prices page (the `settings` table),
// so Zach can change prices without touching code. Safe to use on the server and the phone.
//
// Customer pricing:
// - Labor only (customer's truck): rate per mover per hour (default $75).
// - All-inclusive (2 movers + our 26' truck): one hourly rate ($195 local, $215 when the pickup is
//   far_miles+ from the shop). Extra movers add the per-mover rate. Gas and mileage included.
// - 3-hour minimum. The clock runs from arrival at the first address to the end of unloading.
// - Travel (shop -> first pickup + last drop-off -> shop, by drive TIME): under 2 h free;
//   2 to under 3 h = 1 extra hour per mover; 3 h+ = half the travel time per mover.
// - Overtime: billed hours past the 8th are paid at 1.5x the labor part of the rate.
// - Flat rate (owner's choice for long days): see flatRate().
//
// The old rules ($65/hr, 2-hour minimum, 25 free miles, $1/mile truck) are no longer used.

export type Prices = {
  rate: number; // $ per mover per hour (labor only, extra movers, and the floor)
  min_hours: number; // billed hours are never less than this
  min_movers: number;
  allin_rate: number; // all-inclusive: movers included + our truck, per hour, local
  allin_far_rate: number; // ...when the pickup is far_miles or more from the shop
  far_miles: number;
  allin_movers: number; // movers included in the all-inclusive rate
  travel_free_hours: number; // total travel under this: no charge
  travel_mid_hours: number; // from free_hours to under this: travel_mid_charge hours per mover
  travel_mid_charge: number;
  travel_long_share: number; // at mid_hours or more: this share of the travel time per mover
  long_day_hours: number; // longer than this = long day (flag; overtime after this many billed hours)
  ot_multiplier: number; // overtime pay on the labor part of the rate
  long_day_bonus: number; // flat rate: bonus per mover on long days
  materials: number; // per job, quotes only
  water: number; // per job, quotes only
  nte_cushion_hours: number; // suggested not-to-exceed = estimate + this many hours
  business_phone: string;
  expect_url: string; // "What to expect" page, linked in texts
  zelle: string; // phone or email
  cashapp: string; // $cashtag
  venmo: string; // @username
  apple_cash: string; // phone number
};

export const DEFAULT_PRICES: Prices = {
  rate: 75,
  min_hours: 3,
  min_movers: 2,
  allin_rate: 195,
  allin_far_rate: 215,
  far_miles: 45,
  allin_movers: 2,
  travel_free_hours: 2,
  travel_mid_hours: 3,
  travel_mid_charge: 1,
  travel_long_share: 0.5,
  long_day_hours: 8,
  ot_multiplier: 1.5,
  long_day_bonus: 100,
  materials: 20,
  water: 5,
  nte_cushion_hours: 1,
  business_phone: "(209) 326-5601",
  expect_url: "",
  zelle: "",
  cashapp: "",
  venmo: "",
  apple_cash: "",
};

export const PRICE_COLUMNS =
  "rate, min_hours, min_movers, allin_rate, allin_far_rate, far_miles, allin_movers, travel_free_hours, travel_mid_hours, travel_mid_charge, travel_long_share, long_day_hours, ot_multiplier, long_day_bonus, materials, water, nte_cushion_hours, business_phone, expect_url, zelle, cashapp, venmo, apple_cash";

export type QuoteInputs = {
  movers: number | string | null;
  /** Hours on the clock: arrival at the first address to the end of unloading (drive between addresses included). */
  est_hours: number | string | null;
  miles_out: number | string | null;
  miles_between: number | string | null;
  miles_back: number | string | null;
  truck: "ours" | "theirs";
  /** Drive time, shop -> first pickup (minutes). */
  drive_out_min?: number | string | null;
  /** Drive time, last drop-off -> shop (minutes). */
  drive_back_min?: number | string | null;
  /** Older: a fixed hourly rate for the whole crew. Kept for saved quotes; new quotes use truck_rate. */
  rate_override?: number | string | null;
  /** Truck at cost: the truck's share per hour. Rate = movers x labor rate + this (follows the number of movers). */
  truck_rate?: number | string | null;
};

/** Hourly rates are rounded to the nearest $5. */
export const roundTo5 = (n: number) => Math.round(n / 5) * 5;

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Travel charge: hours per mover for a total travel time (hours). */
export function travelHoursPerMover(travelHours: number, s: Prices) {
  if (travelHours < s.travel_free_hours) return 0;
  if (travelHours < s.travel_mid_hours) return s.travel_mid_charge;
  return round2(travelHours * s.travel_long_share);
}

/** Hourly price. `extraHours` adds hours on the clock (used for the not-to-exceed cushion). */
export function priceQuote(q: QuoteInputs, s: Prices, extraHours = 0) {
  const movers = Math.max(s.min_movers, Math.round(num(q.movers)) || s.min_movers);
  const hours = Math.max(s.min_hours, num(q.est_hours) + extraHours);
  const allIn = q.truck !== "theirs";
  const far = allIn && num(q.miles_out) >= s.far_miles;

  // The hourly rate for the whole crew.
  const baseRate = far ? s.allin_far_rate : s.allin_rate;
  const extraMovers = allIn ? Math.max(0, movers - s.allin_movers) : 0;
  const standardRate = allIn ? baseRate + extraMovers * s.rate : movers * s.rate;
  const truckRate = allIn ? num(q.truck_rate) : 0;
  const override = num(q.rate_override);
  const hourlyRate = truckRate > 0 ? movers * s.rate + truckRate : override > 0 ? override : standardRate;
  const adjusted = hourlyRate !== standardRate;
  /** The part of an all-inclusive hour that pays for the truck (customer side). */
  const truckPerHour = allIn ? Math.max(0, hourlyRate - movers * s.rate) : 0;

  // Overtime: billed hours past long_day_hours pay ot_multiplier on the labor part.
  const regularHours = Math.min(hours, s.long_day_hours);
  const otHours = Math.max(0, hours - s.long_day_hours);
  const otRate = hourlyRate + (s.ot_multiplier - 1) * movers * s.rate;
  const clock = round2(hourlyRate * regularHours + otRate * otHours);

  // Travel time to and from the shop.
  const driveOut = num(q.drive_out_min);
  const driveBack = num(q.drive_back_min);
  const travelHours = round2((driveOut + driveBack) / 60);
  const travelPerMover = travelHoursPerMover(travelHours, s);
  const travel = round2(travelPerMover * movers * s.rate);

  const dayHours = round2(hours + travelHours);
  const longDay = dayHours > s.long_day_hours;
  const supplies = s.materials + s.water;
  const total = round2(clock + travel + supplies);
  const truckMiles = num(q.miles_out) + num(q.miles_between) + num(q.miles_back);

  return {
    movers,
    hours,
    allIn,
    far,
    hourlyRate,
    standardRate,
    adjusted,
    truckPerHour,
    regularHours,
    otHours,
    otRate,
    clock,
    travelHours,
    travelPerMover,
    travel,
    dayHours,
    longDay,
    supplies,
    total,
    truckMiles,
    // Older names, still used by saved invoices: labor = time on the clock, trip = travel, truck = 0 (included).
    labor: clock,
    trip: travel,
    truck: 0,
  };
}

/** Estimate plus the cushion hours, rounded up to the next $10. */
export function suggestedNte(q: QuoteInputs, s: Prices) {
  return Math.ceil(priceQuote(q, s, s.nte_cushion_hours).total / 10) * 10;
}

/**
 * Flat rate for long days: all day hours (clock + travel) x movers x the floor rate,
 * + the long-day bonus per mover, + the margin on that labor, + our truck cost at cost (no margin). Rounded up to $10.
 */
export function flatRate(q: QuoteInputs, s: Prices, truckCost: number, margin: number) {
  const p = priceQuote(q, s);
  const labor = round2(p.dayHours * p.movers * s.rate);
  const bonus = p.longDay ? p.movers * s.long_day_bonus : 0;
  const truck = p.allIn ? truckCost : 0;
  const subtotal = round2(labor + bonus + truck);
  // The margin is on labor only: the truck is passed through at cost.
  const marginAmount = round2((labor + bonus) * margin);
  const total = Math.ceil((subtotal + marginAmount) / 10) * 10;
  return { dayHours: p.dayHours, movers: p.movers, labor, bonus, truck, subtotal, margin, marginAmount, total };
}

export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

/** "1 h 05 min" from hours. */
export const fmtDuration = (h: number) => {
  const m = Math.round(h * 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")} min` : ""}`;
};

/** Typed drive time -> minutes. Accepts "45", "1:30", "1.5h", "1 h 30", "90 min". Empty or bad = null. */
export function parseDrive(raw: string): number | null {
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  let m = t.match(/^(\d+):(\d{1,2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = t.match(/^(\d+(?:\.\d+)?)\s*h(?:rs?|ours?)?\s*(?:(\d+)\s*m(?:in)?)?$/);
  if (m) return Math.round(Number(m[1]) * 60 + Number(m[2] ?? 0));
  m = t.match(/^(\d+(?:\.\d+)?)\s*(?:m|min|mins|minutes)?$/);
  if (m) return Math.round(Number(m[1]));
  return null;
}

export const REFER_ITEMS = /piano|hot ?tub|jacuzzi|spa tub/i;

/**
 * Invoice math: the same hourly and travel rules, but no materials, water or extra lines.
 * A job booked at a flat rate is billed at that flat rate.
 */
export function priceInvoice(q: QuoteInputs, s: Prices, flatPrice?: number | null) {
  const p = priceQuote(q, s);
  if (flatPrice != null && flatPrice > 0) return { ...p, supplies: 0, clock: flatPrice, labor: flatPrice, travel: 0, trip: 0, total: flatPrice, flat: true as const };
  return { ...p, supplies: 0, total: round2(p.clock + p.travel), flat: false as const };
}
