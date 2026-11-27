"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { swapCrew } from "@/app/jobs/swap-actions";
import { BAND_TEXT, hoursBand } from "@/lib/hours-alert";

const hrs = (n: number) => String(Math.round(n * 100) / 100);

export type WorkItem = {
  id: string;
  day: string;
  time: string;
  hours: number;
  customer: string;
  route: string;
  open: number;
  needed: number;
  note: string;
  /** Movers on the job (most hours first): swapping out someone with plenty of hours is the fair pick. */
  swappable: { id: string; name: string; hours: number }[];
  hasLead: boolean;
};

/** Each job: "Add [name]" if it still needs crew, or swap them in for one of the movers. */
export function WorkList({ personId, first, items }: { personId: string; first: string; items: WorkItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<{ job: string; text: string } | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});
  const [, start] = useTransition();

  const run = (jobId: string, outId: string | null, label: string) =>
    start(async () => {
      setBusy(jobId);
      setError(null);
      const res = await swapCrew(jobId, outId, personId);
      setBusy("");
      if (res.error) setError({ job: jobId, text: res.error });
      else {
        setDone((d) => ({ ...d, [jobId]: label }));
        router.refresh();
      }
    });

  if (!items.length)
    return <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">No jobs left this week that {first} is free for.</p>;

  return (
    <ul className="flex flex-col gap-3">
      {items.map((it) => (
        <li key={it.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold tabular-nums text-ink">
                {it.day} · {it.time}
              </p>
              <Link href={`/jobs/${it.id}`} className="break-words text-base font-semibold text-primary">
                {it.customer}
              </Link>
              {it.route && <p className="text-sm text-muted">{it.route}</p>}
              {it.note && <p className="text-xs font-semibold text-warn">{it.note}</p>}
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${it.open ? "bg-bad-fill text-white" : "bg-bg text-muted"}`}>
              {it.open ? `Needs ${it.open}` : "Full"} · {it.hours} hrs
            </span>
          </div>

          {done[it.id] ? (
            <p className="rounded-xl bg-ok/12 px-3 py-2 text-sm font-semibold text-ok">✓ {done[it.id]}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {it.open > 0 && (
                <button
                  type="button"
                  disabled={busy === it.id}
                  onClick={() => run(it.id, null, `${first} added`)}
                  className="press h-11 self-start rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50 dark:text-navy"
                >
                  Add {first} · +{hrs(it.hours)} hrs
                </button>
              )}
              {it.swappable.length > 0 && (
                <div className="rounded-xl bg-bg px-3 py-1">
                  <p className="pt-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{it.open > 0 ? "Or swap in for" : "Swap in for"}</p>
                  <ul className="divide-y divide-line">
                    {it.swappable.map((m) => {
                      const band = hoursBand(m.hours);
                      const low = band === "low";
                      const after = m.hours - it.hours;
                      return (
                        <li key={m.id} className="flex items-center gap-3 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-semibold text-ink">{m.name}</p>
                            <p className={`text-xs font-semibold tabular-nums ${BAND_TEXT[band]}`}>
                              {hrs(m.hours)} hrs this week · {hrs(Math.max(0, after))} after the swap
                              {low ? " · already low" : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={busy === it.id}
                            onClick={() => run(it.id, m.id, `${first} swapped in for ${m.name}`)}
                            className="press h-10 shrink-0 rounded-xl border border-line bg-card px-3 text-sm font-semibold text-ink disabled:opacity-50"
                          >
                            Swap
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {!it.open && !it.swappable.length && <p className="text-sm text-muted">Only the lead is on this job. Open it to change the lead.</p>}
            </div>
          )}
          {error?.job === it.id && <p role="alert" className="text-sm text-bad">{error.text}</p>}
        </li>
      ))}
    </ul>
  );
}
