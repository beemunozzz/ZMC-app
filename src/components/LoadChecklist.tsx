"use client";

import { useOptimistic, useState, useTransition } from "react";
import { tickItem } from "@/app/jobs/checklist-actions";
import type { ChecklistItem } from "@/lib/checklist";
import { Icon } from "./Icon";

/** "Before you leave": tap each item as it goes on the truck. Shared by everyone on the job. */
export function LoadChecklist({ jobId, items, canTick }: { jobId: string; items: ChecklistItem[]; canTick: boolean }) {
  const [list, setList] = useOptimistic(items, (cur, { label, done }: { label: string; done: boolean }) =>
    cur.map((i) => (i.label === label ? { ...i, done, by: done ? "You" : undefined } : i)),
  );
  const [, start] = useTransition();
  const [error, setError] = useState("");
  const done = list.filter((i) => i.done).length;
  const all = done === list.length;
  const [open, setOpen] = useState(!all);
  if (!list.length) return null;

  return (
    <section className={`flex flex-col gap-2 rounded-xl border p-3 ${all ? "border-ok/40 bg-ok/8" : "border-line bg-card"}`}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center justify-between gap-3 text-left">
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold text-ink">{all ? "✓ Truck loaded" : "Before you leave"}</span>
          <span className="block text-sm text-muted">{all ? "Everything's on the truck." : "Tap each item as it goes on the truck."}</span>
        </span>
        <span className={`shrink-0 text-sm font-semibold tabular-nums ${all ? "text-ok" : "text-muted"}`}>
          {done}/{list.length}
        </span>
      </button>
      <div className="h-1.5 overflow-hidden rounded-full bg-bg" aria-hidden>
        <div className="h-full rounded-full bg-ok transition-[width]" style={{ width: `${(done / list.length) * 100}%` }} />
      </div>
      {open && (
        <ul className="flex flex-col">
          {list.map((i) => (
            <li key={i.label}>
              <button
                type="button"
                disabled={!canTick}
                aria-pressed={i.done}
                onClick={() =>
                  start(async () => {
                    setError("");
                    setList({ label: i.label, done: !i.done });
                    const r = await tickItem(jobId, i.label, !i.done);
                    if (r.error) setError(r.error);
                  })
                }
                className="press -mx-1 flex w-full items-center gap-3 rounded-lg px-1 py-2 text-left disabled:cursor-default"
              >
                <span
                  aria-hidden
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${i.done ? "border-ok bg-ok text-white" : "border-line"}`}
                >
                  {i.done && <Icon name="check" className="h-4 w-4" />}
                </span>
                <span className={`min-w-0 flex-1 text-[15px] ${i.done ? "text-muted line-through" : "text-ink"}`}>{i.label}</span>
                {i.done && i.by && <span className="shrink-0 text-xs text-muted">{i.by}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
    </section>
  );
}
