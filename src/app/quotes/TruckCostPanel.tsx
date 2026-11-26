"use client";

import { money, type Prices } from "@/lib/pricing";
import { truckCost, type OwnerCosts, type TruckChoices } from "@/lib/truck-cost";

const input =
  "block h-11 w-full min-w-0 rounded-xl border border-line bg-bg px-3 text-base tabular-nums text-ink outline-none focus:border-primary";
const label = "flex min-w-0 flex-col gap-1 text-sm font-medium text-ink";
const LONG_TRIP_MILES = 150;

export type TruckForm = { miles: string; days: string; type: "round" | "oneway"; oneway: string; fuel: "unleaded" | "diesel"; follow: string };

export const toChoices = (t: TruckForm, autoMiles: number, autoFollow: number): TruckChoices => ({
  miles: Number(t.miles) || autoMiles,
  days: Math.max(1, Math.round(Number(t.days) || 1)),
  type: t.type,
  oneway_price: Number(t.oneway) || 0,
  fuel: t.fuel,
  follow_miles: t.follow === "" ? autoFollow : Number(t.follow) || 0,
});

const Est = () => <span className="ml-1 rounded-full bg-warn/12 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-warn">estimate</span>;

/**
 * OWNER ONLY. What the U-Haul truck really costs ZMC for this quote, and whether the truck part of
 * the all-inclusive rate covers it. Never shown to customers or crew.
 */
export function TruckCostPanel({
  t,
  setT,
  costs,
  prices,
  autoMiles,
  autoFollow,
  movers,
  hours,
  hourlyRate,
  truckPerHour,
}: {
  t: TruckForm;
  setT: (f: (o: TruckForm) => TruckForm) => void;
  costs: OwnerCosts;
  prices: Prices;
  autoMiles: number;
  autoFollow: number;
  movers: number;
  hours: number;
  hourlyRate: number;
  truckPerHour: number;
}) {
  const choices = toChoices(t, autoMiles, autoFollow);
  const c = truckCost(choices, costs);
  const customerPays = Math.round(truckPerHour * hours * 100) / 100;
  const diff = Math.round((customerPays - c.total) * 100) / 100;
  const profit = diff >= 0;
  const laborPerHour = movers * prices.rate;
  const breakEven = Math.ceil(laborPerHour + c.total / hours);
  const withProfit = Math.ceil(laborPerHour + (c.total + prices.rate) / hours);

  // Long trips: compare a round trip with a one-way rental.
  const long = choices.miles >= LONG_TRIP_MILES;
  const round = truckCost({ ...choices, type: "round" }, costs);
  const oneway = choices.oneway_price > 0 ? truckCost({ ...choices, type: "oneway" }, costs) : null;

  const set = (k: keyof TruckForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setT((o) => ({ ...o, [k]: e.target.value }));
  const row = (name: React.ReactNode, amount: number, est = true) => (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="min-w-0 text-ink">
        {name}
        {est && <Est />}
      </span>
      <span className="shrink-0 tabular-nums text-ink">{money(amount)}</span>
    </div>
  );

  return (
    <section className="flex flex-col gap-3 rounded-2xl border-2 border-primary/30 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-lg font-extrabold uppercase text-ink">Our truck cost</h2>
        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">Only you see this</span>
      </div>

      {/* Hidden copies so the choices save with the quote */}
      <input type="hidden" name="tc_miles" value={t.miles} />
      <input type="hidden" name="tc_days" value={t.days} />
      <input type="hidden" name="tc_type" value={t.type} />
      <input type="hidden" name="tc_oneway" value={t.oneway} />
      <input type="hidden" name="tc_fuel" value={t.fuel} />
      <input type="hidden" name="tc_follow" value={t.follow} />

      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          <span>Truck miles</span>
          <input type="number" inputMode="decimal" min={0} value={t.miles} onChange={set("miles")} placeholder={String(autoMiles || 0)} className={input} />
        </label>
        <label className={label}>
          <span>Rental days</span>
          <input type="number" inputMode="numeric" min={1} step={1} value={t.days} onChange={set("days")} className={input} />
        </label>
        <label className={label}>
          <span>Rental type</span>
          <select value={t.type} onChange={set("type")} className={input}>
            <option value="round">Round trip</option>
            <option value="oneway">One-way</option>
          </select>
        </label>
        <label className={label}>
          <span>Fuel</span>
          <select value={t.fuel} onChange={set("fuel")} className={input}>
            <option value="unleaded">Unleaded</option>
            <option value="diesel">Diesel</option>
          </select>
        </label>
      </div>
      <p className="-mt-1 text-xs text-muted">
        Truck miles = shop → pickup → drop-off → shop, filled in from the miles above (type over it to change). Round trip = pick up and return in Stockton.
        One-way = drop the truck at the destination. U-Haul trucks take unleaded.
      </p>

      {t.type === "oneway" && (
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            <span>U-Haul one-way price</span>
            <input type="number" inputMode="decimal" min={0} value={t.oneway} onChange={set("oneway")} placeholder="e.g. 324" className={input} />
          </label>
          <label className={label}>
            <span>Crew ride home</span>
            <input type="number" inputMode="decimal" min={0} value={t.follow} onChange={set("follow")} placeholder={`${autoFollow} mi`} className={input} />
          </label>
          <p className="col-span-2 -mt-1 text-xs text-muted">
            Type the price U-Haul shows for this route and date (e.g. Stockton → South Lake Tahoe about $324, Stockton → LA about $638 on a weekday in Dec
            2026).
          </p>
        </div>
      )}

      <div className="divide-y divide-line rounded-xl bg-bg px-3">
        {row(
          <>
            Rental · {c.type === "oneway" ? `one-way ${money(choices.oneway_price)}` : `${c.days} day${c.days > 1 ? "s" : ""}, ${choices.miles} mi`}
          </>,
          c.rental,
        )}
        {row(<>Gas · {choices.miles} mi ÷ {costs.truck_mpg} MPG × {money(choices.fuel === "diesel" ? costs.diesel_price : costs.gas_price)}</>, c.gas)}
        {row(<>Truck pickup and return time</>, c.pickup, false)}
        {c.type === "oneway" && row(<>Crew ride home · {choices.follow_miles} mi ÷ {costs.follow_mpg} MPG</>, c.rideHome)}
        <div className="flex items-baseline justify-between gap-3 py-2">
          <span className="font-semibold text-ink">Total truck cost to us</span>
          <span className="font-display text-xl font-extrabold tabular-nums text-ink">{money(c.total)}</span>
        </div>
      </div>
      {c.type === "oneway" && <p className="-mt-1 text-xs text-warn">One-way: the crew needs a way home (a follow car or a ride).</p>}

      <div className="flex flex-col gap-1 text-sm">
        <div className="flex items-start justify-between gap-3">
          <span className="min-w-0 text-ink">
            Customer pays us for the truck
            <span className="block text-xs text-muted tabular-nums">
              ({money(hourlyRate)} − {movers} × {money(prices.rate)}) × {hours} hrs
            </span>
          </span>
          <span className="shrink-0 tabular-nums text-ink">{money(customerPays)}</span>
        </div>
        <div
          className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 font-semibold ${profit ? "bg-ok/12 text-ok" : "bg-bad/10 text-bad"}`}
        >
          <span>{profit ? "▲ Profit on the truck" : "▼ Loss on the truck"}</span>
          <span className="tabular-nums">{money(Math.abs(diff))}</span>
        </div>
        {!profit && (
          <p className="text-sm text-ink">
            To break even, charge <b className="tabular-nums">{money(breakEven)}/hr</b>. To make {money(prices.rate)} on the truck:{" "}
            <b className="tabular-nums">{money(withProfit)}/hr</b> (for {movers} movers, {hours} hrs).
          </p>
        )}
      </div>

      {long && (
        <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
          <p className="text-sm font-semibold text-ink">Long trip: round trip or one-way?</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className={`rounded-lg p-2 ${oneway && round.total <= oneway.total ? "bg-ok/12" : "bg-bg"}`}>
              <p className="text-xs text-muted">Round trip</p>
              <p className="font-semibold tabular-nums text-ink">{money(round.total)}</p>
            </div>
            <div className={`rounded-lg p-2 ${oneway && oneway.total < round.total ? "bg-ok/12" : "bg-bg"}`}>
              <p className="text-xs text-muted">One-way</p>
              <p className="font-semibold tabular-nums text-ink">{oneway ? money(oneway.total) : "Add the price"}</p>
            </div>
          </div>
          <p className="text-xs text-muted">
            {oneway
              ? `${oneway.total < round.total ? "One-way" : "Round trip"} is cheaper by ${money(Math.abs(round.total - oneway.total))} (including gas, pickup time${oneway ? " and the crew's ride home" : ""}).`
              : "Pick One-way above and type U-Haul's one-way price to compare."}
          </p>
        </div>
      )}

      <p className="text-xs text-muted">
        <Est /> U-Haul prices from an online quote for a weekday in Dec 2026. Weekends and summer usually cost more. Confirm at checkout.
      </p>
    </section>
  );
}
