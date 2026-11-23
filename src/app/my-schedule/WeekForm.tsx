"use client";

import { useActionState, useState } from "react";
import { WEEKDAYS, WEEKDAY_LABEL, type DayRule, type Week, type Weekday } from "@/lib/regular";
import { saveWeek, type WeekState } from "./actions";

const input = "block h-11 w-full min-w-0 rounded-xl border border-line bg-bg px-3 text-left text-base text-ink outline-none focus:border-primary";
const CHOICES: [DayRule["k"], string][] = [
  ["all", "All day"],
  ["some", "Some hours"],
  ["off", "Off"],
];

export function WeekForm({ start, isFirst, onCancel }: { start: Week; isFirst: boolean; onCancel?: () => void }) {
  const [state, action, pending] = useActionState<WeekState, FormData>(saveWeek, {});
  const [kinds, setKinds] = useState<Record<Weekday, DayRule["k"]>>(
    Object.fromEntries(WEEKDAYS.map((d) => [d, start[d].k])) as Record<Weekday, DayRule["k"]>,
  );

  if (state.ok) {
    return <p className="rounded-xl bg-ok/12 px-3 py-3 text-[15px] font-medium text-ok">✓ {state.ok}</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        {WEEKDAYS.map((d) => {
          const r = start[d];
          return (
            <li key={d} className="flex flex-col gap-2 p-3">
              <fieldset className="grid grid-cols-[5.5rem_1fr] items-center gap-2">
                <legend className="sr-only">{WEEKDAY_LABEL[d]}</legend>
                <span aria-hidden className="text-[15px] font-semibold text-ink">
                  {WEEKDAY_LABEL[d]}
                </span>
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-bg p-1">
                  {CHOICES.map(([k, l]) => (
                    <label
                      key={k}
                      className={`press flex h-9 cursor-pointer items-center justify-center rounded-lg text-[13px] font-semibold ${
                        kinds[d] === k ? (k === "off" ? "bg-card text-bad shadow-sm" : "bg-card text-ink shadow-sm") : "text-muted"
                      }`}
                    >
                      <input type="radio" name={`${d}_k`} value={k} checked={kinds[d] === k} onChange={() => setKinds((s) => ({ ...s, [d]: k }))} className="sr-only" />
                      {l}
                    </label>
                  ))}
                </div>
              </fieldset>
              {kinds[d] === "some" && (
                <div className="grid grid-cols-2 gap-2 pl-0 sm:pl-[6rem]">
                  <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted">
                    <span>Can start at</span>
                    <input type="time" name={`${d}_from`} defaultValue={r.k === "some" ? r.from ?? "" : ""} className={input} />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted">
                    <span>Off by</span>
                    <input type="time" name={`${d}_until`} defaultValue={r.k === "some" ? r.until ?? "18:00" : "18:00"} className={input} />
                  </label>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-ink">
        <span>
          Why? <span className="font-normal text-muted">(optional)</span>
        </span>
        <input name="note" placeholder="e.g. school pickup at 6" className={`${input} h-12`} autoComplete="off" />
      </label>

      <p className="rounded-xl bg-bg px-3 py-2 text-sm text-muted">
        {isFirst
          ? "Your first schedule is saved right away and kept as your original. Changes later need Zach's OK."
          : "Zach needs to approve changes. Your current schedule stays until he does."}
      </p>
      {state.error && <p role="alert" className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{state.error}</p>}
      <div className={`grid gap-2 ${onCancel ? "grid-cols-2" : ""}`}>
        {onCancel && (
          <button type="button" onClick={onCancel} className="press h-12 rounded-xl border border-line font-semibold text-ink">
            Cancel
          </button>
        )}
        <button disabled={pending} className="press h-12 rounded-xl bg-primary font-semibold text-white disabled:opacity-60 dark:text-navy">
          {pending ? "Saving…" : isFirst ? "Save my schedule" : "Send to Zach"}
        </button>
      </div>
    </form>
  );
}

/** "Ask to change" button that opens the form. */
export function ChangeWeek({ start }: { start: Week }) {
  const [open, setOpen] = useState(false);
  if (open) return <WeekForm start={start} isFirst={false} onCancel={() => setOpen(false)} />;
  return (
    <button type="button" onClick={() => setOpen(true)} className="press h-12 rounded-xl border-2 border-primary font-semibold text-primary">
      Ask to change my schedule
    </button>
  );
}
