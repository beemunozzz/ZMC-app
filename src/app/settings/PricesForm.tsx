"use client";

import { useActionState, useState } from "react";
import { money, priceQuote, type Prices } from "@/lib/pricing";
import { savePrices, type SettingsState } from "./actions";

const input =
  "h-12 w-full min-w-0 rounded-xl border border-line bg-bg px-3 text-base tabular-nums text-ink outline-none focus:border-primary";

type Field = { key: keyof Prices; label: string; help?: string; prefix?: string; suffix?: string; step?: number };

const GROUPS: { title: string; fields: Field[] }[] = [
  {
    title: "Labor",
    fields: [
      { key: "rate", label: "Rate", prefix: "$", suffix: "per mover per hour", step: 1 },
      { key: "min_hours", label: "Minimum hours", suffix: "hours", help: "Billed hours are never less than this.", step: 0.5 },
      { key: "min_movers", label: "Minimum movers", suffix: "movers", step: 1 },
    ],
  },
  {
    title: "Trip charge",
    fields: [
      { key: "trip_free_miles", label: "Free miles", suffix: "miles", help: "Shop → pickup plus drop-off → shop, added together.", step: 1 },
      { key: "trip_step_miles", label: "Then, for every", suffix: "miles (or part of it)", step: 1 },
      { key: "trip_step_hours", label: "Add", suffix: "hours per mover", step: 0.25 },
    ],
  },
  {
    title: "Truck and supplies",
    fields: [
      { key: "truck_per_mile", label: "Truck, when we bring ours", prefix: "$", suffix: "per mile (all truck miles)", step: 0.25 },
      { key: "materials", label: "Materials", prefix: "$", suffix: "per job (quotes only)", step: 1 },
      { key: "water", label: "Crew water", prefix: "$", suffix: "per job (quotes only)", step: 1 },
    ],
  },
  {
    title: "Not-to-exceed price",
    fields: [{ key: "nte_cushion_hours", label: "Suggested cushion", suffix: "extra hours on top of the estimate", step: 0.5 }],
  },
];

export function PricesForm({ prices }: { prices: Prices }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(savePrices, {});
  const [v, setV] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(prices).map(([k, val]) => [k, String(val)])),
  );
  const live: Prices = {
    ...prices,
    ...Object.fromEntries(Object.entries(v).map(([k, val]) => [k, k === "business_phone" ? val : Number(val) || 0])),
    trip_step_miles: Number(v.trip_step_miles) || 1,
  };
  const ex = priceQuote({ movers: 2, est_hours: 4, miles_out: 15, miles_between: 12, miles_back: 20, truck: "ours" }, live);

  return (
    <form action={action} className="flex flex-col gap-4 pb-6">
      {GROUPS.map((g) => (
        <section key={g.title} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
          <h2 className="font-display text-lg font-extrabold uppercase text-ink">{g.title}</h2>
          {g.fields.map((f) => (
            <label key={f.key} className="flex flex-col gap-1 text-sm font-medium text-ink">
              {f.label}
              <div className="flex items-center gap-2">
                <span className="w-3 shrink-0 text-muted">{f.prefix}</span>
                <input
                  name={f.key}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={f.step}
                  required
                  value={v[f.key]}
                  onChange={(e) => setV((o) => ({ ...o, [f.key]: e.target.value }))}
                  className={`${input} max-w-28`}
                />
                {f.suffix && <span className="text-sm font-normal text-muted">{f.suffix}</span>}
              </div>
              {f.help && <span className="text-xs font-normal text-muted">{f.help}</span>}
            </label>
          ))}
        </section>
      ))}

      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
        <h2 className="font-display text-lg font-extrabold uppercase text-ink">Business</h2>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Phone in quote replies
          <input
            name="business_phone"
            type="tel"
            value={v.business_phone}
            onChange={(e) => setV((o) => ({ ...o, business_phone: e.target.value }))}
            className={input}
          />
        </label>
      </section>

      <section className="rounded-2xl bg-tape/15 p-4 text-sm text-ink">
        <p className="font-semibold">Example with these prices</p>
        <p className="mt-1 text-muted">2 movers, 4 hours, our truck, 15 mi to pickup, 12 mi between, 20 mi back:</p>
        <p className="mt-2 tabular-nums">
          Labor {money(ex.labor)} · Trip {money(ex.trip)} · Truck {money(ex.truck)} · Supplies {money(ex.supplies)}
        </p>
        <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">= {money(ex.total)}</p>
      </section>

      {state.error && (
        <p role="alert" className="rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">
          {state.error}
        </p>
      )}
      {state.ok && <p className="rounded-xl bg-ok/12 px-4 py-3 text-sm font-medium text-ok">✓ {state.ok}</p>}

      <button
        disabled={pending}
        className="press flex h-12 items-center justify-center rounded-xl bg-primary font-semibold text-white disabled:opacity-60 dark:text-navy"
      >
        {pending ? "Saving…" : "Save prices"}
      </button>
    </form>
  );
}
