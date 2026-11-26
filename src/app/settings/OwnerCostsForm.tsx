"use client";

import { useActionState } from "react";
import { PERCENT_COSTS, type OwnerCosts } from "@/lib/truck-cost";
import { saveOwnerCosts } from "./actions";

const input =
  "h-12 w-full min-w-0 max-w-28 rounded-xl border border-line bg-bg px-3 text-base tabular-nums text-ink outline-none focus:border-primary";

type F = { key: keyof OwnerCosts; label: string; prefix?: string; suffix: string; step: number; est?: boolean };

const GROUPS: { title: string; fields: F[] }[] = [
  {
    title: "U-Haul 26' truck (round trip, in town)",
    fields: [
      { key: "uhaul_daily", label: "Daily rate", prefix: "$", suffix: "per day", step: 0.01 },
      { key: "uhaul_per_mile", label: "Mileage", prefix: "$", suffix: "per mile (every mile)", step: 0.01 },
      { key: "uhaul_coverage_day", label: "Damage coverage", prefix: "$", suffix: "per day", step: 1, est: true },
      { key: "uhaul_env_fee", label: "Environmental fee", prefix: "$", suffix: "per rental", step: 1, est: true },
      { key: "sales_tax", label: "Sales tax", suffix: "% (on rental, mileage and coverage)", step: 0.25 },
    ],
  },
  {
    title: "Gas",
    fields: [
      { key: "truck_mpg", label: "Truck miles per gallon (loaded)", suffix: "MPG", step: 0.5 },
      { key: "gas_price", label: "Regular unleaded", prefix: "$", suffix: "per gallon", step: 0.01 },
      { key: "diesel_price", label: "Diesel", prefix: "$", suffix: "per gallon", step: 0.01 },
      { key: "follow_mpg", label: "Crew ride home (one-way rentals)", suffix: "MPG", step: 1 },
    ],
  },
  {
    title: "Time and margin",
    fields: [
      { key: "truck_pickup_cost", label: "Picking up and returning the truck", prefix: "$", suffix: "(one person, one hour)", step: 1 },
      { key: "flat_margin", label: "Flat-rate profit margin", suffix: "%", step: 1 },
    ],
  },
];

/** Owner only: what the truck and gas really cost ZMC. Never shown to customers or crew. */
export function OwnerCostsForm({ costs }: { costs: OwnerCosts }) {
  const [state, action, pending] = useActionState(saveOwnerCosts, {});
  const shown = (k: keyof OwnerCosts) => (PERCENT_COSTS.includes(k) ? String(Math.round(costs[k] * 10000) / 100) : String(costs[k]));

  return (
    <form action={action} className="flex flex-col gap-4 rounded-2xl border-2 border-primary/30 bg-card p-4">
      <div>
        <h2 className="font-display text-lg font-extrabold uppercase text-ink">Our costs</h2>
        <p className="text-xs text-muted">
          Owner only. Crew and customers never see these. Used for the &ldquo;Our truck cost&rdquo; panel on quotes and for flat rates.
        </p>
      </div>
      {GROUPS.map((g) => (
        <fieldset key={g.title} className="flex flex-col gap-3">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{g.title}</legend>
          {g.fields.map((f) => (
            <label key={f.key} className="flex flex-col gap-1 text-sm font-medium text-ink">
              <span>
                {f.label}
                {f.est && <span className="ml-1.5 rounded-full bg-warn/12 px-2 py-0.5 text-[11px] font-semibold text-warn">estimate</span>}
              </span>
              <div className="flex items-center gap-2">
                <span className="w-3 shrink-0 text-muted">{f.prefix}</span>
                <input name={f.key} type="number" inputMode="decimal" min={0} step={f.step} required defaultValue={shown(f.key)} className={input} />
                <span className="text-sm font-normal text-muted">{f.suffix}</span>
              </div>
            </label>
          ))}
        </fieldset>
      ))}
      <p className="rounded-xl bg-bg px-3 py-2 text-xs text-muted">
        U-Haul prices from an online quote for a weekday in Dec 2026. Weekends and summer usually cost more. Confirm at checkout.
      </p>
      {state.error && <p role="alert" className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{state.error}</p>}
      {state.ok && <p className="rounded-xl bg-ok/12 px-3 py-2 text-sm font-medium text-ok">✓ {state.ok}</p>}
      <button disabled={pending} className="press h-12 rounded-xl bg-primary font-semibold text-white disabled:opacity-60 dark:text-navy">
        {pending ? "Saving…" : "Save costs"}
      </button>
    </form>
  );
}
