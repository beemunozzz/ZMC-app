"use client";

import { useState, useTransition } from "react";
import { setJobStep, type Step } from "@/app/jobs/step-actions";

const STEPS: { key: Step; label: string; field: "arrived_at" | "loaded_at" | "at_dropoff_at" | "done_at" }[] = [
  { key: "arrived", label: "Arrived", field: "arrived_at" },
  { key: "loaded", label: "Loaded, leaving", field: "loaded_at" },
  { key: "dropoff", label: "At drop-off", field: "at_dropoff_at" },
  { key: "done", label: "Done", field: "done_at" },
];

const time = (ts: string) => new Date(ts).toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" });
const mins = (a: string, b: string) => {
  const m = Math.round((Date.parse(b) - Date.parse(a)) / 60000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
};

/** The crew lead taps each moment of the move. The times teach the app how long jobs really take. */
export function JobSteps({ jobId, times, hasDropoff }: { jobId: string; times: Partial<Record<(typeof STEPS)[number]["field"], string | null>>; hasDropoff: boolean }) {
  const steps = hasDropoff ? STEPS : STEPS.filter((s) => s.key !== "loaded" && s.key !== "dropoff");
  const [t, setT] = useState(times);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const next = steps.find((s) => !t[s.field]);
  const last = [...steps].reverse().find((s) => t[s.field]);

  const tap = (s: (typeof STEPS)[number], on: boolean) =>
    start(async () => {
      setError("");
      const before = t;
      setT({ ...t, [s.field]: on ? new Date().toISOString() : null });
      const res = await setJobStep(jobId, s.key, on);
      if (res.error) {
        setT(before);
        setError(res.error);
      }
    });

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <div>
        <h2 className="font-display text-lg font-extrabold uppercase text-ink">Job timeline</h2>
        <p className="text-sm text-muted">Tap each one as it happens. It helps Zach quote future moves more accurately.</p>
      </div>
      <ol className="flex flex-col gap-2">
        {steps.map((s, i) => {
          const at = t[s.field];
          const prev = i > 0 ? t[steps[i - 1].field] : null;
          const isNext = next?.key === s.key;
          return (
            <li key={s.key} className="flex items-center gap-3">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${at ? "bg-ok text-white dark:text-navy" : isNext ? "bg-primary text-white dark:text-navy" : "bg-line text-muted"}`}
              >
                {at ? "✓" : i + 1}
              </span>
              {at ? (
                <p className="min-w-0 flex-1 text-[15px] text-ink">
                  <b>{s.label}</b> <span className="tabular-nums text-muted">· {time(at)}</span>
                  {prev && <span className="block text-xs tabular-nums text-muted">{mins(prev, at)} after the step before</span>}
                </p>
              ) : (
                <button
                  type="button"
                  disabled={!isNext || pending}
                  onClick={() => tap(s, true)}
                  className="press h-11 min-w-0 flex-1 rounded-xl bg-primary px-3 text-left font-semibold text-white disabled:bg-bg disabled:text-muted dark:text-navy"
                >
                  {s.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {last && (
        <button type="button" disabled={pending} onClick={() => tap(last, false)} className="self-start text-sm font-semibold text-muted">
          Undo &ldquo;{last.label}&rdquo;
        </button>
      )}
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
    </section>
  );
}
