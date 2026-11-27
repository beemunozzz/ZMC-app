"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { SignaturePad } from "@/components/SignaturePad";
import { PAY_METHODS, type PayMethod } from "@/lib/invoices";
import { fmtDuration, money, priceInvoice, type Prices } from "@/lib/pricing";
import { createInvoice, type InvoiceFormState } from "@/app/invoices/actions";
import { hourChoices, hoursLabel, moverChoices } from "@/lib/choices";

const input =
  "h-12 w-full min-w-0 rounded-xl border border-line bg-bg px-3 text-base tabular-nums text-ink outline-none focus:border-primary";
const label = "flex min-w-0 flex-col gap-1 text-sm font-medium text-ink";
const section = "flex flex-col gap-3 rounded-2xl border border-line bg-card p-4";
const heading = "font-display text-lg font-extrabold uppercase text-ink";

export type InvoiceStart = {
  jobId: string;
  customerName: string;
  hours: string;
  /** Where the hours came from. */
  hoursFrom: "clock" | "estimate";
  movers: string;
  truck: "ours" | "theirs";
  miles_out: string;
  miles_between: string;
  miles_back: string;
  /** Drive time shop -> pickup and drop-off -> shop (minutes), from the quote. */
  driveOut: number | null;
  driveBack: number | null;
  /** Booked at a flat rate: the bill is this price. */
  flatPrice: number | null;
  /** Adjusted hourly rate agreed in the quote (null = standard). */
  rateOverride: number | null;
  /** Truck at cost: the truck's share per hour (the rate follows the number of movers). */
  truckRate: number | null;
  /** null = the job has no not-to-exceed price yet, so ask for it */
  nte: number | null;
};

export function InvoiceForm({ start, prices, enabledMethods }: { start: InvoiceStart; prices: Prices; enabledMethods: PayMethod[] }) {
  const [state, action, pending] = useActionState<InvoiceFormState, FormData>(createInvoice, {});
  const [v, setV] = useState({
    hours: start.hours,
    movers: start.movers,
    truck: start.truck,
    miles_out: start.miles_out,
    miles_between: start.miles_between,
    miles_back: start.miles_back,
    nte: start.nte != null ? String(start.nte) : "",
    signed_name: start.customerName.replace(/^example:\s*/i, ""),
  });
  const [signed, setSigned] = useState(false);
  const [agree, setAgree] = useState(false);
  const [method, setMethod] = useState<PayMethod | "">("");
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((o) => ({ ...o, [k]: e.target.value }));

  const p = priceInvoice({ ...v, est_hours: v.hours, drive_out_min: start.driveOut, drive_back_min: start.driveBack, rate_override: start.rateOverride, truck_rate: start.truckRate }, prices, start.flatPrice);
  const nte = Number(v.nte) || 0;
  const over = nte > 0 && p.total > nte;
  // The customer verifies the hours. If the hours or movers change afterwards, they need to verify again.
  const [verifiedFor, setVerifiedFor] = useState<string | null>(null);
  const verifyKey = `${p.hours}|${p.movers}|${p.total}`;
  const verified = verifiedFor === verifyKey;
  const signOk = !signed || (agree && !!v.signed_name.trim());
  const ready = !over && nte > 0 && Number(v.hours) > 0 && verified && signOk && !!method;

  const line = (text: React.ReactNode, amount: number) => (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <span className="min-w-0 text-ink">{text}</span>
      <span className="shrink-0 font-semibold tabular-nums text-ink">{money(amount)}</span>
    </div>
  );

  return (
    <form action={action} className="flex flex-col gap-4 pb-6">
      <input type="hidden" name="job_id" value={start.jobId} />

      {/* 1. Hours and crew (crew lead fills this in) */}
      <section className={section}>
        <h2 className={heading}>Time and crew</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            Hours on the job
            <select name="hours" required value={v.hours} onChange={set("hours")} className={input}>
              <option value="">Choose</option>
              {hourChoices(0.25, 0.25, 16, v.hours).map((h) => (
                <option key={h} value={String(h)}>
                  {hoursLabel(h)}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Movers
            <select name="movers" value={v.movers} onChange={set("movers")} className={input}>
              {moverChoices(1, 10).map((n) => (
                <option key={n} value={n}>
                  {n} movers
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-xs text-muted">
          {start.hoursFrom === "clock"
            ? "Hours come from the crew's clock-in and clock-out times (rounded up to the next 15 minutes). Movers come from the assigned crew. Change either if needed."
            : "Filled in from the estimate and the assigned crew. Change them to match the real job."}
        </p>
        <label className={label}>
          Truck
          <select name="truck" value={v.truck} onChange={set("truck")} className={input}>
            <option value="ours">We provide the truck</option>
            <option value="theirs">Customer provides the truck</option>
          </select>
        </label>
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
      </section>

      {/* 2. The bill */}
      <section className={section}>
        <h2 className={heading}>Invoice</h2>
        <div className="divide-y divide-line">
          {p.flat ? (
            line(<>Flat rate (agreed when booked)</>, p.total)
          ) : (
            <>
              {line(
                <>
                  {p.allIn ? `${p.movers} movers + our truck` : `${p.movers} movers`} · {money(p.hourlyRate)}/hr × {p.regularHours} hrs
                  {Number(v.hours) < prices.min_hours && <span className="block text-xs text-muted">{prices.min_hours}-hour minimum</span>}
                </>,
                p.hourlyRate * p.regularHours,
              )}
              {p.otHours > 0 && line(<>Overtime · {money(p.otRate)}/hr × {p.otHours} hrs</>, p.otRate * p.otHours)}
              {line(
                <>
                  Travel time · {fmtDuration(p.travelHours)} to and from the shop
                  <span className="block text-xs text-muted">
                    {p.travelPerMover ? `+${p.travelPerMover} hr per mover` : `Free under ${prices.travel_free_hours} hours`}
                  </span>
                </>,
                p.travel,
              )}
            </>
          )}
        </div>
        <div className="flex items-baseline justify-between border-t-2 border-ink pt-2">
          <span className="font-display text-xl font-extrabold uppercase text-ink">Total</span>
          <span className="font-display text-4xl font-extrabold tabular-nums text-ink">{money(p.total)}</span>
        </div>

        {start.nte != null ? (
          <p className={`rounded-xl px-3 py-2 text-sm ${over ? "bg-bad/10 font-semibold text-bad" : "bg-ok/12 text-ok"}`}>
            {over
              ? `⚠ Over the not-to-exceed price of ${money(nte)}. The bill can't go over it. Lower the hours or charges before saving.`
              : `✓ Under the not-to-exceed price of ${money(nte)}.`}
          </p>
        ) : (
          <>
            <label className={label}>
              Written not-to-exceed price given to the customer ($)
              <input name="nte" type="number" inputMode="decimal" min={0} step={10} required value={v.nte} onChange={set("nte")} className={input} />
            </label>
            {over && <p className="rounded-xl bg-bad/10 px-3 py-2 text-sm font-semibold text-bad">⚠ The total is over this not-to-exceed price. It can&apos;t be saved.</p>}
          </>
        )}
      </section>

      {/* 3. Customer verifies the hours (required) */}
      <section className={`${section} ${verified ? "border-ok/50" : "border-primary/50"}`}>
        <h2 className={heading}>Customer: verify the hours</h2>
        <p className="text-sm text-muted">Hand the phone to the customer.</p>
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-bg p-3 text-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Hours</p>
            <p className="font-display text-2xl font-extrabold tabular-nums text-ink">{p.hours}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Movers</p>
            <p className="font-display text-2xl font-extrabold tabular-nums text-ink">{p.movers}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Total</p>
            <p className="font-display text-2xl font-extrabold tabular-nums text-ink">{money(p.total)}</p>
          </div>
        </div>
        <input type="hidden" name="verified" value={verified ? "1" : ""} />
        {verified ? (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-ok/12 px-3 py-3">
            <span className="pop text-[15px] font-semibold text-ok">✓ Hours verified by the customer</span>
            <button type="button" onClick={() => setVerifiedFor(null)} className="text-sm font-medium text-muted">
              Undo
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={!(Number(v.hours) > 0) || over}
            onClick={() => setVerifiedFor(verifyKey)}
            className="press flex h-14 items-center justify-center rounded-xl bg-ok text-lg font-semibold text-white disabled:opacity-50 dark:text-navy"
          >
            ✓ I verify these hours
          </button>
        )}
        <p className="text-xs text-muted">Once saved, only Zach can change these hours.</p>
      </section>

      {/* 4. Signature (optional) */}
      <section className={section}>
        <h2 className={heading}>
          Signature <span className="text-muted">(optional)</span>
        </h2>
        <p className="text-sm text-muted">If the customer doesn&apos;t want to sign, leave this blank. The invoice will say they didn&apos;t sign.</p>
        <label className={label}>
          Printed name
          <input name="signed_name" value={v.signed_name} onChange={set("signed_name")} className={input} autoComplete="off" />
        </label>
        <SignaturePad name="signature" onChange={setSigned} />
        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-bg p-3 text-[15px] text-ink">
          <input type="checkbox" name="agree" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--primary)]" />
          <span>
            I agree the move is complete and I&apos;ll pay the total of <b className="tabular-nums">{money(p.total)}</b> to Zachery&apos;s Moving Co.
          </span>
        </label>
      </section>

      {/* 5. How they'll pay */}
      <section className={section}>
        <h2 className={heading}>How are you paying?</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PAY_METHODS.filter((m) => enabledMethods.includes(m.key)).map((m) => (
            <label
              key={m.key}
              className={`press flex h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border text-[15px] font-semibold ${
                method === m.key ? "border-primary bg-primary/10 text-ink" : "border-line text-ink"
              }`}
            >
              <input type="radio" name="payment_method" value={m.key} checked={method === m.key} onChange={() => setMethod(m.key)} className="sr-only" />
              {m.label}
            </label>
          ))}
        </div>
      </section>

      {state.error && (
        <p role="alert" className="rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">
          {state.error}
        </p>
      )}

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-1 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur">
        {!ready && (
          <p className="text-center text-xs text-muted">
            {over
              ? "Total is over the not-to-exceed price"
              : !verified
                ? "Waiting for the customer to verify the hours"
                : signed && !agree
                  ? "They signed, so they also need to tick “I agree”"
                  : signed && !v.signed_name.trim()
                    ? "Type their printed name next to the signature"
                  : !method
                    ? "Pick how they're paying"
                    : "Fill in the hours and the not-to-exceed price"}
          </p>
        )}
        <div className="flex gap-2">
          <Link href={`/jobs/${start.jobId}`} className="press flex h-12 items-center justify-center rounded-xl border border-line px-5 font-semibold text-ink">
            Back
          </Link>
          <button
            disabled={pending || !ready}
            className="press flex h-12 flex-1 items-center justify-center rounded-xl bg-primary font-semibold text-white disabled:opacity-50 dark:text-navy"
          >
            {pending ? "Saving…" : `Save invoice · ${money(p.total)}`}
          </button>
        </div>
      </div>
    </form>
  );
}
