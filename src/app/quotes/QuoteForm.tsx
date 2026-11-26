"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { HouseFields } from "@/components/HouseFields";
import { JOB_TYPES } from "@/lib/jobs";
import { REFER_ITEMS, flatRate, fmtDuration, money, parseDrive, priceQuote, suggestedNte, type Prices } from "@/lib/pricing";
import { truckCost, type OwnerCosts } from "@/lib/truck-cost";
import { TruckCostPanel, toChoices, type TruckForm } from "./TruckCostPanel";
import { HEARD_FROM, QUOTE_STATUS, quoteText, type Quote, type QuoteStatus } from "@/lib/quotes";
import { deleteQuote, saveQuote, type QuoteFormState } from "./actions";

const input =
  "h-12 w-full min-w-0 rounded-xl border border-line bg-bg px-3 text-base text-ink outline-none focus:border-primary";
const label = "flex min-w-0 flex-col gap-1 text-sm font-medium text-ink";
const section = "flex flex-col gap-3 rounded-2xl border border-line bg-card p-4";
const heading = "font-display text-lg font-extrabold uppercase text-ink";

const str = (v: number | string | null | undefined) => (v == null ? "" : String(v));

const minsText = (m: number | null | undefined) => (m == null ? "" : m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}` : String(m));

export function QuoteForm({ quote, prices, costs }: { quote?: Quote; prices: Prices; costs: OwnerCosts }) {
  const [state, action, pending] = useActionState<QuoteFormState, FormData>(saveQuote, {});
  const [v, setV] = useState({
    customer_name: quote?.customer_name ?? "",
    move_date: quote?.move_date ?? "",
    start_time: quote?.start_time?.slice(0, 5) ?? "08:00",
    truck: quote?.truck ?? ("ours" as "ours" | "theirs"),
    movers: str(quote?.movers ?? prices.min_movers),
    est_hours: str(quote?.est_hours),
    miles_out: str(quote?.miles_out),
    miles_between: str(quote?.miles_between),
    miles_back: str(quote?.miles_back),
    heavy_items: quote?.heavy_items ?? "",
    nte: str(quote?.nte),
    status: quote?.status ?? ("new" as QuoteStatus),
    drive_out: minsText(quote?.drive_out_min),
    drive_back: minsText(quote?.drive_back_min),
    pricing: quote?.pricing ?? ("hourly" as "hourly" | "flat"),
  });
  const tc0 = quote?.truck_cost ?? {};
  const [tf, setTf] = useState<TruckForm>({
    miles: tc0.miles ? String(tc0.miles) : "",
    days: String(tc0.days ?? 1),
    type: tc0.type ?? "round",
    oneway: tc0.oneway_price ? String(tc0.oneway_price) : "",
    fuel: tc0.fuel ?? "unleaded",
    follow: tc0.follow_miles != null && tc0.type === "oneway" ? String(tc0.follow_miles) : "",
  });
  const [stories, setStories] = useState({ p: quote?.pickup_house.stories ?? "", d: quote?.dropoff_house.stories ?? "" });
  const [copied, setCopied] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((old) => ({ ...old, [k]: e.target.value }));

  const driveOut = parseDrive(v.drive_out);
  const driveBack = parseDrive(v.drive_back);
  const inputs = { ...v, drive_out_min: driveOut, drive_back_min: driveBack };
  const p = priceQuote(inputs, prices);
  // Our truck cost (owner only) feeds the flat rate.
  const autoFollow = Number(v.miles_back) || 0;
  const tCost = p.allIn ? truckCost(toChoices(tf, p.truckMiles, autoFollow), costs).total : 0;
  const flat = flatRate(inputs, prices, tCost, costs.flat_margin);
  const isFlat = v.pricing === "flat";
  const chosenTotal = isFlat ? flat.total : p.total;
  const nteSuggest = isFlat ? flat.total : suggestedNte(inputs, prices);
  const nte = Number(v.nte) || 0;
  // Whole-day check: labor pay per mover-hour across the whole day (clock + travel), not counting the truck part.
  const laborPay = p.clock - p.truckPerHour * p.hours + p.travel;
  const perMoverHour = p.dayHours ? laborPay / (p.movers * p.dayHours) : 0;
  const reply = quoteText(
    {
      ...v,
      movers: Number(v.movers),
      est_hours: Number(v.est_hours) || null,
      miles_out: Number(v.miles_out) || null,
      miles_between: Number(v.miles_between) || null,
      miles_back: Number(v.miles_back) || null,
      nte: nte || null,
      drive_out_min: driveOut,
      drive_back_min: driveBack,
      flat_price: isFlat ? flat.total : null,
    },
    prices,
  );
  const refer = REFER_ITEMS.test(v.heavy_items);
  const twoStory = Number(stories.p) >= 2 || Number(stories.d) >= 2;
  const booked = !!quote?.job_id;

  async function copy() {
    try {
      await navigator.clipboard.writeText(reply);
      setCopied("Copied. Paste it into your text to the customer.");
    } catch {
      setCopied("Couldn't copy automatically. Press and hold the text above to copy it.");
    }
    if (v.status === "new") setV((old) => ({ ...old, status: "quoted" }));
  }

  const line = (text: React.ReactNode, amount: number) => (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <span className="min-w-0 text-ink">{text}</span>
      <span className="shrink-0 font-semibold tabular-nums text-ink">{money(amount)}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4">
        {quote && <input type="hidden" name="id" value={quote.id} />}

        <section className={section}>
          <h2 className={heading}>Customer</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={label}>
              Name
              <input name="customer_name" required value={v.customer_name} onChange={set("customer_name")} className={input} autoComplete="off" />
            </label>
            <label className={label}>
              Phone
              <input name="customer_phone" type="tel" inputMode="tel" defaultValue={quote?.customer_phone} className={input} autoComplete="off" />
            </label>
            <label className={label}>
              How they heard about ZMC
              <select name="heard_from" defaultValue={quote?.heard_from ?? ""} className={input}>
                <option value="">Choose one</option>
                {HEARD_FROM.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className={section}>
          <h2 className={heading}>When and what</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className={label}>
              Move date
              <input type="date" name="move_date" value={v.move_date} onChange={set("move_date")} className={input} />
            </label>
            <label className={label}>
              Start time
              <input type="time" name="start_time" value={v.start_time} onChange={set("start_time")} className={input} />
            </label>
            <label className={`${label} col-span-2 sm:col-span-1`}>
              Type of job
              <select name="job_type" defaultValue={quote?.job_type ?? "Full move"} className={input}>
                {JOB_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className={section}>
          <h2 className={heading}>Pickup</h2>
          <label className={label}>
            Pickup address
            <input name="pickup_address" defaultValue={quote?.pickup_address} placeholder="Street, city" className={input} autoComplete="off" />
          </label>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">House at pickup</p>
          <HouseFields prefix="pickup" house={quote?.pickup_house ?? {}} onStories={(s) => setStories((o) => ({ ...o, p: s }))} />
        </section>

        <section className={section}>
          <h2 className={heading}>Drop-off</h2>
          <label className={label}>
            Drop-off address
            <input name="dropoff_address" defaultValue={quote?.dropoff_address} placeholder="Street, city" className={input} autoComplete="off" />
          </label>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">House at drop-off</p>
          <HouseFields prefix="dropoff" house={quote?.dropoff_house ?? {}} onStories={(s) => setStories((o) => ({ ...o, d: s }))} />
        </section>

        <section className={section}>
          <h2 className={heading}>What&apos;s moving</h2>
          <label className={label}>
            Size
            <input name="size" defaultValue={quote?.size} placeholder="e.g. 3 bed, full garage" className={input} autoComplete="off" />
          </label>
          <label className={label}>
            Heavy or special items
            <input name="heavy_items" value={v.heavy_items} onChange={set("heavy_items")} placeholder="e.g. gun safe, sectional" className={input} autoComplete="off" />
          </label>
          {refer && (
            <p className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">
              ⚠ ZMC doesn&apos;t move pianos or hot tubs. Refer that item to a partner mover. The reply text below already says so.
            </p>
          )}
          <label className={label}>
            Notes from the customer
            <textarea
              name="notes"
              defaultValue={quote?.notes}
              rows={3}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-base text-ink outline-none focus:border-primary"
            />
          </label>
        </section>

        <section className={section}>
          <h2 className={heading}>Crew, hours and miles</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className={`${label} col-span-2 sm:col-span-1`}>
              Truck
              <select name="truck" value={v.truck} onChange={set("truck")} className={input}>
                <option value="ours">We bring ours</option>
                <option value="theirs">Customer has their own</option>
              </select>
            </label>
            <label className={label}>
              Movers
              <select name="movers" value={v.movers} onChange={set("movers")} className={input}>
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} movers
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Hours on the clock
              <input name="est_hours" type="number" inputMode="decimal" min={0} step={0.5} value={v.est_hours} onChange={set("est_hours")} placeholder="e.g. 4" className={input} />
            </label>
          </div>
          {twoStory && Number(v.movers) < 3 && (
            <p className="rounded-xl bg-warn/12 px-3 py-2 text-sm text-warn">Two-story home: think about a 3rd mover.</p>
          )}
          <p className="text-xs text-muted">
            The clock runs from arrival at the first address until unloading is done at the last one. The drive between the customer&apos;s addresses is on the clock.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              Drive: shop → pickup
              <input name="drive_out" inputMode="numeric" value={v.drive_out} onChange={set("drive_out")} placeholder="e.g. 45 or 1:30" className={input} autoComplete="off" />
            </label>
            <label className={label}>
              Drive: drop-off → shop
              <input name="drive_back" inputMode="numeric" value={v.drive_back} onChange={set("drive_back")} placeholder="e.g. 45 or 1:30" className={input} autoComplete="off" />
            </label>
          </div>
          {((v.drive_out && driveOut == null) || (v.drive_back && driveBack == null)) && (
            <p className="text-sm text-bad">Type minutes (45) or hours and minutes (1:30).</p>
          )}
          <p className="text-xs text-muted">Travel time to and from the shop. Under {prices.travel_free_hours} hours total is free.</p>
          <div className="grid grid-cols-3 items-end gap-3">
            <label className={label}>
              Shop → pickup
              <input name="miles_out" type="number" inputMode="decimal" min={0} value={v.miles_out} onChange={set("miles_out")} placeholder="mi" className={input} />
            </label>
            <label className={label}>
              Between
              <input name="miles_between" type="number" inputMode="decimal" min={0} value={v.miles_between} onChange={set("miles_between")} placeholder="mi" className={input} />
            </label>
            <label className={label}>
              Drop-off → shop
              <input name="miles_back" type="number" inputMode="decimal" min={0} value={v.miles_back} onChange={set("miles_back")} placeholder="mi" className={input} />
            </label>
          </div>
          <p className="text-xs text-muted">
            Miles are for our truck cost and the far-pickup rate ({prices.far_miles}+ mi from the shop to the pickup = {money(prices.allin_far_rate)}/hr).
          </p>
        </section>

        {/* The price builds itself */}
        <section className={section}>
          <h2 className={heading}>Price</h2>
          <input type="hidden" name="pricing" value={v.pricing} />
          <div className="divide-y divide-line">
            {line(
              <>
                {p.allIn ? `${p.movers} movers + our 26' truck` : `Labor · ${p.movers} movers × ${money(prices.rate)}`} · {money(p.hourlyRate)}/hr × {p.regularHours} hrs
                <span className="block text-xs text-muted">
                  {p.allIn
                    ? `${p.far ? `Far pickup (${prices.far_miles}+ mi)` : "Local"} all-inclusive${p.movers > prices.allin_movers ? `, incl. ${p.movers - prices.allin_movers} extra mover${p.movers - prices.allin_movers > 1 ? "s" : ""} at ${money(prices.rate)}/hr` : ""}. Gas and mileage included.`
                    : "Customer provides the truck."}
                  {Number(v.est_hours) < prices.min_hours && ` ${prices.min_hours}-hour minimum.`}
                </span>
              </>,
              p.hourlyRate * p.regularHours,
            )}
            {p.otHours > 0 &&
              line(
                <>
                  Overtime · {money(p.otRate)}/hr × {p.otHours} hrs
                  <span className="block text-xs text-muted">
                    After {prices.long_day_hours} hrs, labor is paid at {prices.ot_multiplier}×.
                  </span>
                </>,
                p.otRate * p.otHours,
              )}
            {line(
              <>
                Travel time · {fmtDuration(p.travelHours)} to and from the shop
                <span className="block text-xs text-muted">
                  {p.travelPerMover
                    ? `+${p.travelPerMover} hr per mover × ${p.movers} × ${money(prices.rate)}`
                    : `Free under ${prices.travel_free_hours} hours total`}
                </span>
              </>,
              p.travel,
            )}
            {line(<>Materials and crew water</>, p.supplies)}
          </div>

          {p.longDay && (
            <p className="rounded-xl bg-warn/12 px-3 py-2 text-sm text-warn">
              ⚠ Long day: about {fmtDuration(p.dayHours)} with travel. A flat rate may be the better choice.
            </p>
          )}
          {perMoverHour > 0 && perMoverHour < prices.rate && (
            <p className="text-xs text-muted">
              Whole day: labor works out to {money(Math.round(perMoverHour * 100) / 100)} per mover-hour, under the {money(prices.rate)} floor. A flat rate
              keeps it at the floor or above.
            </p>
          )}

          {/* Hourly or flat: side by side */}
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Price type">
            {(
              [
                ["hourly", "Hourly", p.total, `${p.hours} hrs on the clock`],
                ["flat", "Flat rate", flat.total, `${fmtDuration(flat.dayHours)} day`],
              ] as const
            ).map(([k, name, amount, sub]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={v.pricing === k}
                onClick={() => setV((o) => ({ ...o, pricing: k }))}
                className={`press flex flex-col items-start rounded-xl border-2 p-3 text-left ${v.pricing === k ? "border-primary bg-primary/10" : "border-line"}`}
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {v.pricing === k ? "✓ " : ""}
                  {name}
                </span>
                <span className="font-display text-2xl font-extrabold tabular-nums text-ink">{money(amount)}</span>
                <span className="text-xs text-muted">{sub}</span>
              </button>
            ))}
          </div>
          <details className="rounded-xl bg-bg px-3 py-2 text-sm">
            <summary className="cursor-pointer font-semibold text-primary">How the flat rate is worked out</summary>
            <div className="mt-2 flex flex-col gap-1 tabular-nums text-ink">
              <p>
                {fmtDuration(flat.dayHours)} × {flat.movers} movers × {money(prices.rate)} = {money(flat.labor)}
              </p>
              {flat.bonus > 0 && (
                <p>
                  + long-day bonus {flat.movers} × {money(prices.long_day_bonus)} = {money(flat.bonus)}
                </p>
              )}
              {flat.truck > 0 && <p>+ our truck cost (estimate) {money(flat.truck)}</p>}
              <p>
                + {Math.round(flat.margin * 100)}% margin {money(flat.marginAmount)} → rounded up to {money(flat.total)}
              </p>
              <p className="text-xs text-muted">Only you see this breakdown. The customer just sees the flat price.</p>
            </div>
          </details>

          <div className="flex items-baseline justify-between border-t-2 border-ink pt-2">
            <span className="font-display text-xl font-extrabold uppercase text-ink">{isFlat ? "Flat rate" : "Estimate"}</span>
            <span className="font-display text-3xl font-extrabold tabular-nums text-ink">{money(chosenTotal)}</span>
          </div>

          <label className={label}>
            Not-to-exceed price ($)
            <div className="flex gap-2">
              <input name="nte" type="number" inputMode="decimal" min={0} step={10} value={v.nte} onChange={set("nte")} className={input} />
              <button
                type="button"
                onClick={() => setV((o) => ({ ...o, nte: String(nteSuggest) }))}
                className="press h-12 shrink-0 rounded-xl border border-line px-3 text-sm font-semibold text-primary"
              >
                Use {money(nteSuggest)}
              </button>
            </div>
          </label>
          <p className={`text-xs ${nte && nte < chosenTotal ? "font-semibold text-bad" : "text-muted"}`}>
            {nte && nte < chosenTotal
              ? "⚠ This is lower than the estimate. Raise it: the final bill can't go over it."
              : `California requires a written not-to-exceed price on hourly moves. ${isFlat ? "On a flat rate, use the flat price." : `Suggested: the estimate plus ${prices.nte_cushion_hours} hour${prices.nte_cushion_hours === 1 ? "" : "s"}, rounded up.`}`}
          </p>
        </section>

        {p.allIn && (
          <TruckCostPanel
            t={tf}
            setT={setTf}
            costs={costs}
            prices={prices}
            autoMiles={p.truckMiles}
            autoFollow={autoFollow}
            movers={p.movers}
            hours={p.hours}
            hourlyRate={p.hourlyRate}
            truckPerHour={p.truckPerHour}
          />
        )}

        <section className={section}>
          <h2 className={heading}>Text for the customer</h2>
          <p className="whitespace-pre-wrap break-words rounded-xl bg-bg p-3 text-sm text-ink select-all">{reply}</p>
          <button type="button" onClick={copy} className="press flex h-12 items-center justify-center rounded-xl border border-line font-semibold text-ink">
            Copy text
          </button>
          {copied && <p className="text-sm text-ok">✓ {copied}</p>}
          <label className={label}>
            Status
            <select name="status" value={v.status} onChange={set("status")} className={input}>
              {Object.entries(QUOTE_STATUS).map(([k, s]) => (
                <option key={k} value={k}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        {state.error && (
          <p role="alert" className="rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">
            {state.error}
          </p>
        )}
        {state.ok && <p className="text-sm font-medium text-ok">✓ {state.ok}</p>}

        <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur">
          <button
            name="intent"
            value="save"
            disabled={pending}
            className="press flex h-12 flex-1 items-center justify-center rounded-xl border border-line bg-card font-semibold text-ink disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save quote"}
          </button>
          {booked ? (
            <Link
              href={`/jobs/${quote!.job_id}`}
              className="press flex h-12 flex-1 items-center justify-center rounded-xl bg-ok font-semibold text-white dark:text-navy"
            >
              Booked ✓ View job
            </Link>
          ) : (
            <button
              name="intent"
              value="book"
              disabled={pending}
              className="press flex h-12 flex-1 items-center justify-center rounded-xl bg-primary font-semibold text-white disabled:opacity-60 dark:text-navy"
            >
              Book it
            </button>
          )}
        </div>
      </form>

      {quote && (
        <form action={deleteQuote} className="pb-6">
          <input type="hidden" name="id" value={quote.id} />
          {confirmDelete ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-bad/10 p-3">
              <span className="text-sm font-medium text-bad">Delete this quote? A job booked from it stays on the schedule.</span>
              <div className="flex gap-2">
                <button className="press h-11 rounded-xl bg-bad px-4 text-sm font-semibold text-white dark:text-navy">Yes, delete</button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="press h-11 rounded-xl border border-line px-4 text-sm font-semibold text-ink">
                  Keep it
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm font-semibold text-bad">
              Delete quote
            </button>
          )}
        </form>
      )}
    </div>
  );
}
