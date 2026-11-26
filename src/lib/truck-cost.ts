// What OUR truck really costs ZMC (U-Haul rental + gas + pickup time). OWNER ONLY:
// these numbers come from the owner-only `owner_costs` table and must never reach customers or crew.

export type OwnerCosts = {
  uhaul_daily: number; // 26' truck, in-town, per day
  uhaul_per_mile: number; // charged on every mile
  uhaul_coverage_day: number; // damage coverage per day (estimate)
  uhaul_env_fee: number; // per rental (estimate)
  sales_tax: number; // 0.09 = 9% (Stockton), on rental, mileage and coverage
  truck_mpg: number; // loaded 26' truck
  gas_price: number; // regular unleaded, $ per gallon
  diesel_price: number;
  follow_mpg: number; // the car that brings the crew home after a one-way rental
  truck_pickup_cost: number; // one person's time to pick up, set up and return the truck
  flat_margin: number; // 0.15 = 15% profit margin on flat rates
};

export const DEFAULT_COSTS: OwnerCosts = {
  uhaul_daily: 50.95,
  uhaul_per_mile: 1.09,
  uhaul_coverage_day: 30,
  uhaul_env_fee: 5,
  sales_tax: 0.09,
  truck_mpg: 8,
  gas_price: 5.6,
  diesel_price: 7.5,
  follow_mpg: 25,
  truck_pickup_cost: 75,
  flat_margin: 0.15,
};

export const COST_KEYS = Object.keys(DEFAULT_COSTS) as (keyof OwnerCosts)[];
/** Shown and typed as percents (9 = 9%), saved as fractions (0.09). */
export const PERCENT_COSTS: (keyof OwnerCosts)[] = ["sales_tax", "flat_margin"];

/** The owner's choices in the "Our truck cost" panel, saved with the quote. */
export type TruckChoices = {
  miles: number; // total truck miles: shop -> pickup -> drop-off -> shop
  days: number;
  type: "round" | "oneway";
  oneway_price: number; // U-Haul's one-way price for this route and date
  fuel: "unleaded" | "diesel";
  follow_miles: number; // crew ride home after a one-way rental
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function rentalRound(miles: number, days: number, c: OwnerCosts) {
  const base = days * c.uhaul_daily + miles * c.uhaul_per_mile + days * c.uhaul_coverage_day;
  return r2(base * (1 + c.sales_tax) + c.uhaul_env_fee);
}

export function rentalOneWay(price: number, days: number, c: OwnerCosts) {
  return r2((price + days * c.uhaul_coverage_day) * (1 + c.sales_tax) + c.uhaul_env_fee);
}

export function gasCost(miles: number, fuel: "unleaded" | "diesel", c: OwnerCosts) {
  return r2((miles / (c.truck_mpg || 1)) * (fuel === "diesel" ? c.diesel_price : c.gas_price));
}

/** Everything the panel shows, for one rental type. */
export function truckCost(t: TruckChoices, c: OwnerCosts) {
  const days = Math.max(1, Math.round(t.days) || 1);
  const rental = t.type === "oneway" ? rentalOneWay(t.oneway_price, days, c) : rentalRound(t.miles, days, c);
  const gas = gasCost(t.miles, t.fuel, c);
  const pickup = c.truck_pickup_cost;
  const rideHome = t.type === "oneway" ? r2((t.follow_miles / (c.follow_mpg || 1)) * c.gas_price) : 0;
  const total = r2(rental + gas + pickup + rideHome);
  return { type: t.type, days, rental, gas, pickup, rideHome, total };
}
