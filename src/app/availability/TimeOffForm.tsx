"use client";

import { useActionState, useState } from "react";
import { addDays } from "@/lib/dates";
import { addTimeOff, type AvailState } from "./actions";

const input = "h-12 w-full min-w-0 rounded-xl border border-line bg-bg px-3 text-base text-ink outline-none focus:border-primary";
const label = "flex min-w-0 flex-col gap-1 text-sm font-medium text-ink";

export function TimeOffForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState<AvailState, FormData>(addTimeOff, {});
  const [kind, setKind] = useState<"day" | "until">("day");
  const [start, setStart] = useState(addDays(today, 7));
  const late = start < addDays(today, 7);

  return (
    <form action={action} key={state.ok} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <h2 className="font-display text-lg font-extrabold uppercase text-ink">I&apos;m not available</h2>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          From
          <input type="date" name="start_date" required min={today} value={start} onChange={(e) => setStart(e.target.value)} className={input} />
        </label>
        <label className={label}>
          To <span className="font-normal text-muted">(same day if blank)</span>
          <input type="date" name="end_date" min={start} className={input} />
        </label>
      </div>

      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="sr-only">How much of the day</legend>
        {(
          [
            ["day", "All day"],
            ["until", "Only part of the day"],
          ] as const
        ).map(([k, l]) => (
          <label
            key={k}
            className={`press flex h-12 cursor-pointer items-center justify-center rounded-xl border text-[15px] font-semibold ${
              kind === k ? "border-primary bg-primary/10 text-ink" : "border-line text-ink"
            }`}
          >
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
            {l}
          </label>
        ))}
      </fieldset>
      {kind === "until" && (
        <label className={label}>
          I can work until
          <input type="time" name="until_time" defaultValue="15:00" className={`${input} max-w-40`} />
        </label>
      )}

      <label className={label}>
        Note for Zach <span className="font-normal text-muted">(optional)</span>
        <input name="note" placeholder="e.g. family trip, doctor" className={input} autoComplete="off" />
      </label>

      <p className={`rounded-xl px-3 py-2 text-sm ${late ? "bg-warn/12 text-warn" : "bg-bg text-muted"}`}>
        {late
          ? "That's less than 7 days away, so Zach needs to approve it."
          : "7 or more days ahead: it's saved right away and Zach won't schedule you then."}
      </p>

      {state.error && <p role="alert" className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{state.error}</p>}
      {state.ok && <p className="rounded-xl bg-ok/12 px-3 py-2 text-sm font-medium text-ok">✓ {state.ok}</p>}

      <button disabled={pending} className="press h-12 rounded-xl bg-primary font-semibold text-white disabled:opacity-60 dark:text-navy">
        {pending ? "Saving…" : late ? "Send to Zach" : "Save"}
      </button>
    </form>
  );
}
