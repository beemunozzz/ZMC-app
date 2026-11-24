"use client";

import { useActionState } from "react";
import { saveLoadList } from "./actions";

/** The everyday "before you leave" checklist every job gets. */
export function LoadListForm({ list }: { list: string }) {
  const [state, action, pending] = useActionState(saveLoadList, {});
  return (
    <form action={action} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <h2 className="font-display text-lg font-extrabold uppercase text-ink">Truck checklist</h2>
      <p className="text-sm text-muted">
        One item per line. Every job gets this list. Add <b>(rain)</b> at the end of an item to show it only when rain is expected. You can add extra items for one job on the job form.
      </p>
      <textarea name="load_list" defaultValue={list} rows={12} className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-base leading-relaxed text-ink outline-none focus:border-primary" />
      {state.error && <p role="alert" className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{state.error}</p>}
      {state.ok && <p className="rounded-xl bg-ok/12 px-3 py-2 text-sm font-medium text-ok">✓ {state.ok}</p>}
      <button disabled={pending} className="press h-12 rounded-xl bg-primary font-semibold text-white disabled:opacity-60 dark:text-navy">
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
