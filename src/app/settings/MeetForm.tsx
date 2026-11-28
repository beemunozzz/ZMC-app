"use client";

import { useActionState } from "react";
import { saveMeetSettings } from "./actions";

const input = "block h-12 w-full min-w-0 rounded-xl border border-line bg-bg px-3 text-base text-ink outline-none focus:border-primary";
const label = "flex min-w-0 flex-col gap-1.5 text-sm font-medium text-ink";

/** Where the crew meets before a job (the shop) and how early. */
export function MeetForm({ shop, buffer, early }: { shop: string; buffer: number; early: number }) {
  const [state, action, pending] = useActionState(saveMeetSettings, {});
  return (
    <form action={action} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <h2 className="font-display text-lg font-extrabold uppercase text-ink">Meeting at the shop</h2>
      <label className={label}>
        <span>Shop address (where the crew meets)</span>
        <input name="shop_address" defaultValue={shop} placeholder="Street, Stockton, CA" autoComplete="street-address" className={input} />
      </label>
      <label className={label}>
        <span>Arrive at the job this many minutes early</span>
        <input name="arrive_early_min" type="number" inputMode="numeric" min={0} max={60} defaultValue={early} className={`${input} max-w-32`} />
      </label>
      <label className={label}>
        <span>Crew at the shop this many minutes before the truck leaves</span>
        <input name="meet_buffer_min" type="number" inputMode="numeric" min={0} max={120} defaultValue={buffer} className={`${input} max-w-32`} />
      </label>
      <p className="text-xs text-muted">
        Example: job starts 9:00, 5 minutes early, 40 min drive, 10 minutes at the shop → at the job 8:55, truck leaves 8:15, crew meet at the
        shop at 8:05. Crew meeting at the site are told to be there at 8:55, and each person gets a &ldquo;leave home by&rdquo; time from the
        home address in their My info.
      </p>
      {state.error && <p role="alert" className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{state.error}</p>}
      {state.ok && <p className="rounded-xl bg-ok/12 px-3 py-2 text-sm font-medium text-ok">✓ {state.ok}</p>}
      <button disabled={pending} className="press h-12 rounded-xl bg-primary font-semibold text-white disabled:opacity-60 dark:text-navy">
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
