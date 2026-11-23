"use client";

import { useActionState } from "react";
import { saveMeetSettings } from "./actions";

const input = "block h-12 w-full min-w-0 rounded-xl border border-line bg-bg px-3 text-base text-ink outline-none focus:border-primary";
const label = "flex min-w-0 flex-col gap-1.5 text-sm font-medium text-ink";

/** Where the crew meets before a job (the shop) and how early. */
export function MeetForm({ shop, buffer }: { shop: string; buffer: number }) {
  const [state, action, pending] = useActionState(saveMeetSettings, {});
  return (
    <form action={action} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <h2 className="font-display text-lg font-extrabold uppercase text-ink">Meeting at the shop</h2>
      <label className={label}>
        <span>Shop address (where the crew meets)</span>
        <input name="shop_address" defaultValue={shop} placeholder="Street, Stockton, CA" autoComplete="street-address" className={input} />
      </label>
      <label className={label}>
        <span>Extra minutes before leaving</span>
        <input name="meet_buffer_min" type="number" inputMode="numeric" min={0} max={120} defaultValue={buffer} className={`${input} max-w-32`} />
      </label>
      <p className="text-xs text-muted">
        Example: job starts 9:00, 37 min drive, 10 extra minutes → crew meet at the shop at 8:10 and leave by 8:20.
      </p>
      {state.error && <p role="alert" className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{state.error}</p>}
      {state.ok && <p className="rounded-xl bg-ok/12 px-3 py-2 text-sm font-medium text-ok">✓ {state.ok}</p>}
      <button disabled={pending} className="press h-12 rounded-xl bg-primary font-semibold text-white disabled:opacity-60 dark:text-navy">
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
