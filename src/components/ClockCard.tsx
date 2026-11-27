"use client";

import { useActionState, useEffect, useState } from "react";
import { clockIn, clockOut, type ClockState } from "@/app/payroll/actions";
import { clockTime, entryHours, fmtDuration, type TimeEntry } from "@/lib/time";

/**
 * Big Clock in / Clock out button for the crew's job screen.
 * Feedback is instant; no slow animation on something people do every day.
 */
export function ClockCard({
  open,
  jobId,
  jobLabel,
  weekHours,
}: {
  open: TimeEntry | null;
  jobId: string | null;
  jobLabel: string;
  /** Closed hours this week, not counting the open entry. */
  weekHours: number;
}) {
  const [inState, inAction, inPending] = useActionState<ClockState, FormData>(clockIn, {});
  const [outState, outAction, outPending] = useActionState<ClockState, FormData>(clockOut, {});
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [open]);

  const running = open ? entryHours(open, now) : 0;
  const error = inState.error || outState.error;

  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
      {open ? (
        <form action={outAction}>
          <input type="hidden" name="entry_id" value={open.id} />
          <button
            disabled={outPending}
            className="press flex min-h-16 w-full flex-col items-center justify-center rounded-xl bg-bad-fill px-4 py-2 text-white disabled:opacity-60"
          >
            <span className="text-xl font-bold">{outPending ? "Clocking out…" : "Clock out"}</span>
            <span className="text-sm tabular-nums opacity-90">
              On the clock since {clockTime(open.clock_in)} · {fmtDuration(running)}
            </span>
          </button>
        </form>
      ) : (
        <form action={inAction}>
          <input type="hidden" name="job_id" value={jobId ?? ""} />
          <button
            disabled={inPending || !jobId}
            className="press flex min-h-16 w-full flex-col items-center justify-center rounded-xl bg-ok px-4 py-2 text-white disabled:opacity-50 dark:text-navy"
          >
            <span className="text-xl font-bold">{inPending ? "Clocking in…" : "Clock in"}</span>
            <span className="text-sm opacity-90">{jobId ? jobLabel : "No job to clock in for"}</span>
          </button>
        </form>
      )}
      <p className="text-center text-sm tabular-nums text-muted">
        <b className="text-ink">{fmtDuration(weekHours + running)}</b> clocked this week
      </p>
      {error && (
        <p role="alert" className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}
    </section>
  );
}
