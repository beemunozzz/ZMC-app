"use client";

import { useActionState, useState } from "react";
import { ownerEditHours, type InvoiceFormState } from "../actions";

const input = "h-12 w-full min-w-0 rounded-xl border border-line bg-bg px-3 text-base tabular-nums text-ink outline-none focus:border-primary";

/** Owner only: change the hours after the customer verified them. */
export function EditHours({ id, hours, movers }: { id: string; hours: number; movers: number }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<InvoiceFormState, FormData>(async (prev, form) => {
    const r = await ownerEditHours(prev, form);
    if (!r.error) setOpen(false);
    return r;
  }, {});

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="self-start text-sm font-semibold text-primary">
        Change hours (owner only)
      </button>
    );
  }
  return (
    <form action={action} className="rise flex flex-col gap-3 rounded-2xl border border-warn/40 bg-card p-4">
      <input type="hidden" name="id" value={id} />
      <h2 className="font-display text-lg font-extrabold uppercase text-ink">Change hours</h2>
      <p className="text-sm text-muted">The customer&apos;s verified hours stay on record. The invoice will show that you changed them.</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Hours
          <input name="hours" type="number" inputMode="decimal" min={0} step={0.25} defaultValue={hours} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Movers
          <select name="movers" defaultValue={movers} className={input}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n} movers
              </option>
            ))}
          </select>
        </label>
      </div>
      {state.error && <p className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{state.error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className="press h-12 flex-1 rounded-xl bg-primary font-semibold text-white disabled:opacity-60 dark:text-navy">
          {pending ? "Saving…" : "Save new hours"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="press h-12 rounded-xl border border-line px-5 font-semibold text-ink">
          Cancel
        </button>
      </div>
    </form>
  );
}
