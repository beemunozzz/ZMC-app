// ZMC pricing rules. Every number comes from the Settings page (the `settings` table),
// so Zach can change prices without touching code. Safe to use on the server and the phone.

export type Prices = {
  rate: number; // $ per mover per hour
  min_hours: number; // billed hours are never less than this
  min_movers: number;
  trip_free_miles: number; // shop -> pickup + drop-off -> shop, free up to this
  trip_step_miles: number; // then charge for every this-many miles (or part)
  trip_step_hours: number; // ...this many hours per mover
  truck_per_mile: number; // only when ZMC brings the truck; all truck miles
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
  rate: 65,
  min_hours: 2,
  min_movers: 2,
  trip_free_miles: 25,
  trip_step_miles: 25,
  trip_step_hours: 0.5,
  truck_per_mile: 1,
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
  "rate, min_hours, min_movers, trip_free_miles, trip_step_miles, trip_step_hours, truck_per_mile, materials, water, nte_cushion_hours, business_phone, expect_url, zelle, cashapp, venmo, apple_cash";

export type QuoteInputs = {
  movers: number | string | null;
  est_hours: number | string | null;
  miles_out: number | string | null;
  miles_between: number | string | null;
  miles_back: number | string | null;
  truck: "ours" | "theirs";
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function priceQuote(q: QuoteInputs, s: Prices, extraHours = 0) {
  const movers = Math.max(s.min_movers, Math.round(num(q.movers)) || s.min_movers);
  const hours = Math.max(s.min_hours, num(q.est_hours) + extraHours);
  const out = num(q.miles_out);
  const between = num(q.miles_between);
  const back = num(q.miles_back);

  const labor = movers * hours * s.rate;

  const tripMiles = out + back;
  const tripSteps = tripMiles <= s.trip_free_miles ? 0 : Math.ceil((tripMiles - s.trip_free_miles) / s.trip_step_miles);
  const tripHoursPerMover = tripSteps * s.trip_step_hours;
  const trip = tripHoursPerMover * movers * s.rate;

  const truckMiles = out + between + back;
  const truck = q.truck === "theirs" ? 0 : truckMiles * s.truck_per_mile;

  const supplies = s.materials + s.water;
  const total = labor + trip + truck + supplies;

  return { movers, hours, labor, tripMiles, tripSteps, tripHoursPerMover, trip, truckMiles, truck, supplies, total };
}

/** Estimate plus the cushion hours, rounded up to the next $10. */
export function suggestedNte(q: QuoteInputs, s: Prices) {
  return Math.ceil(priceQuote(q, s, s.nte_cushion_hours).total / 10) * 10;
}

export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

export const REFER_ITEMS = /piano|hot ?tub|jacuzzi|spa tub/i;

/**
 * Invoice math. Same labor, trip and truck rules as quotes, but no materials, water or extra lines.
 * (How the trip charge and truck miles should show on invoices is still to be confirmed with Zach.)
 */
export function priceInvoice(q: QuoteInputs, s: Prices) {
  const p = priceQuote(q, s);
  return { ...p, supplies: 0, total: p.labor + p.trip + p.truck };
}
