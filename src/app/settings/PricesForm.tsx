"use client";

import { useActionState, useState } from "react";
import { money, priceQuote, type Prices } from "@/lib/pricing";
import { savePrices, type SettingsState } from "./actions";
import { hourChoices, hoursLabel } from "@/lib/choices";

const input =
  "h-12 w-full min-w-0 rounded-xl border border-line bg-bg px-3 text-base tabular-nums text-ink outline-none focus:border-primary";

/** `hours` = show a dropdown of hour choices (from, to, step) instead of a type-in box. */
type Field = { key: keyof Prices; label: string; help?: string; prefix?: string; suffix?: string; step?: number; hours?: [number, number, number] };

const GROUPS: { title: string; note?: string; fields: Field[] }[] = [
  {
    title: "Hourly rates",
    note: "The clock runs from arrival at the first address until unloading is done at the last one. The drive between the customer's addresses is on the clock.",
    fields: [
      { key: "rate", label: "Labor only (customer's truck)", prefix: "$", suffix: "per mover per hour", help: "Also the price of each extra mover, and the lowest labor pay per mover-hour for a whole day (the floor).", step: 1 },
      { key: "allin_rate", label: "All-inclusive (movers + our 26' truck)", prefix: "$", suffix: "per hour, local", help: "Gas and mileage included.", step: 1 },
      { key: "allin_far_rate", label: "All-inclusive, far pickup", prefix: "$", suffix: "per hour", step: 1 },
      { key: "far_miles", label: "Far pickup means", suffix: "miles or more from the shop", step: 1 },
      { key: "allin_movers", label: "Movers included in the all-inclusive rate", suffix: "movers", step: 1 },
      { key: "min_hours", label: "Minimum", suffix: "hours", help: "Billed hours are never less than this.", step: 0.5 },
      { key: "min_movers", label: "Quotes start with", suffix: "movers", step: 1 },
    ],
  },
  {
    title: "Travel time (to and from the shop)",
    note: "Drive time from the shop to the first pickup plus from the last drop-off back to the shop.",
    fields: [
      { key: "travel_free_hours", label: "No charge under", suffix: "total", hours: [0.25, 4, 0.25] },
      { key: "travel_mid_hours", label: "From there up to", suffix: "total…", hours: [0.25, 6, 0.25] },
      { key: "travel_mid_charge", label: "…add", suffix: "per mover", hours: [0.25, 4, 0.25] },
      { key: "travel_long_share", label: "At or over that: charge this share of the travel time", suffix: "per mover (0.5 = half)", step: 0.05 },
    ],
  },
  {
    title: "Long days",
    fields: [
      { key: "long_day_hours", label: "A long day is more than", suffix: "hours (on the clock + travel)", help: "Long days are flagged, and a flat rate is suggested.", step: 0.5 },
      { key: "ot_multiplier", label: "Overtime after that many billed hours", suffix: "× the labor rate (1.5 = time and a half)", step: 0.1 },
      { key: "long_day_bonus", label: "Flat rate: long-day bonus", prefix: "$", suffix: "per mover", step: 5 },
    ],
  },
  {
    title: "Supplies and not-to-exceed",
    note: "Materials and crew water are our expense: shown on your side of each quote, never charged to the customer.",
    fields: [
      { key: "materials", label: "Materials (our cost)", prefix: "$", suffix: "per job", step: 1 },
      { key: "water", label: "Crew water (our cost)", prefix: "$", suffix: "per job", step: 1 },
      { key: "nte_cushion_hours", label: "Suggested not-to-exceed cushion", suffix: "extra hours on top of the estimate", step: 0.5 },
    ],
  },
];

export function PricesForm({ prices }: { prices: Prices }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(savePrices, {});
  const [v, setV] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(prices).map(([k, val]) => [k, String(val)])),
  );
  const live: Prices = {
    ...prices,
    ...Object.fromEntries(Object.entries(v).map(([k, val]) => [k, typeof prices[k as keyof Prices] === "string" ? val : Number(val) || 0])),
  };
  const ex = priceQuote({ movers: 2, est_hours: 4, miles_out: 10, miles_between: 15, miles_back: 12, truck: "ours", drive_out_min: 20, drive_back_min: 20 }, live);
  const exTheirs = priceQuote({ movers: 2, est_hours: 4, miles_out: 10, miles_between: 15, miles_back: 12, truck: "theirs", drive_out_min: 20, drive_back_min: 20 }, live);

  return (
    <form action={action} className="flex flex-col gap-4 pb-6">
      {GROUPS.map((g) => (
        <section key={g.title} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
          <h2 className="font-display text-lg font-extrabold uppercase text-ink">{g.title}</h2>
          {g.note && <p className="-mt-1 text-xs text-muted">{g.note}</p>}
          {g.fields.map((f) => (
            <label key={f.key} className="flex flex-col gap-1 text-sm font-medium text-ink">
              {f.label}
              <div className="flex items-center gap-2">
                <span className="w-3 shrink-0 text-muted">{f.prefix}</span>
                {f.hours ? (
                  <select
                    name={f.key}
                    value={v[f.key]}
                    onChange={(e) => setV((o) => ({ ...o, [f.key]: e.target.value }))}
                    className={`${input} max-w-44`}
                  >
                    {hourChoices(f.hours[2], f.hours[0], f.hours[1], v[f.key]).map((h) => (
                      <option key={h} value={String(h)}>
                        {hoursLabel(h)}
                      </option>
                    ))}
                  </select>
                ) : (
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
                )}
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
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          &ldquo;What to expect&rdquo; page link
          <input
            name="expect_url"
            type="url"
            inputMode="url"
            value={v.expect_url}
            onChange={(e) => setV((o) => ({ ...o, expect_url: e.target.value }))}
            placeholder="https://www.zmcmove.com/what-to-expect"
            className={input}
          />
          <span className="text-xs font-normal text-muted">Added to booking and reminder texts. Leave blank until the page is up.</span>
        </label>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
        <h2 className="font-display text-lg font-extrabold uppercase text-ink">Getting paid</h2>
        <p className="text-xs text-muted">Shown to the customer on the &ldquo;Get paid&rdquo; screen after they sign the invoice. Leave blank to hide a method.</p>
        {(
          [
            ["zelle", "Zelle (phone or email)", "(209) 326-5601"],
            ["cashapp", "Cash App $cashtag", "$ZMCmoving"],
            ["venmo", "Venmo username", "@ZMC-Moving"],
            ["apple_cash", "Apple Cash (phone number)", "(209) 326-5601"],
          ] as const
        ).map(([k, l, ph]) => (
          <label key={k} className="flex flex-col gap-1 text-sm font-medium text-ink">
            {l}
            <input name={k} value={v[k]} onChange={(e) => setV((o) => ({ ...o, [k]: e.target.value }))} placeholder={ph} className={input} autoComplete="off" />
          </label>
        ))}
      </section>

      <section className="rounded-2xl bg-tape/15 p-4 text-sm text-ink">
        <p className="font-semibold">Example with these prices</p>
        <p className="mt-1 text-muted">A local 4-hour move, 2 movers, 20 minutes each way from the shop:</p>
        <p className="mt-2 tabular-nums">
          Our truck: {money(ex.hourlyRate)}/hr × {ex.hours} hrs ={" "}
          <b>{money(ex.total)}</b>
        </p>
        <p className="mt-1 tabular-nums">
          Their truck: {money(exTheirs.hourlyRate)}/hr × {exTheirs.hours} hrs ={" "}
          <b>{money(exTheirs.total)}</b>
        </p>
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
