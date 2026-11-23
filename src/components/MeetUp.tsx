"use client";

import { useState, useTransition } from "react";
import { meetAtSite, setJobMeet } from "@/app/jobs/meet-actions";

export type MeetInfo = {
  jobId: string;
  at: "shop" | "site";
  /** "8:10 AM" at the shop, or the job start at the site. */
  time: string;
  /** The job's start time ("9 AM"). */
  start: string;
  leave: string;
  driveText: string;
  /** Others on this job who are meeting at the site instead (first names). */
  atSite: string[];
  /** The viewer is on this job: shows "I'll meet at the site". */
  onJob: boolean;
  meAtSite: boolean;
  /** Zach (any time), or the job's crew lead (until the cutoff): can switch the whole job. */
  canChangeAll: boolean;
  /** Past 8 PM the night before (crew can't change any more; Zach can). */
  locked: boolean;
};

/** Where and when the crew meets. One line, one button. */
export function MeetUp(m: MeetInfo) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setError("");
      const r = await fn();
      if (r.error) setError(r.error);
    });

  const mine = m.onJob && m.at === "shop" && m.meAtSite;
  const headline =
    m.at === "site" ? `Meet at the job site${m.time ? ` · ${m.time}` : ""}` : mine ? `You meet at the site${m.start ? ` · ${m.start}` : ""}` : `Meet at the shop${m.time ? ` · ${m.time}` : ""}`;
  const sub =
    m.at === "site"
      ? "Everyone drives to the pickup address."
      : mine
        ? "Own car, at the pickup address by the start time."
        : [m.driveText, m.leave && `leave by ${m.leave}`].filter(Boolean).join(" · ");

  const small = "press h-10 rounded-xl px-3 text-sm font-semibold disabled:opacity-60";

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-bg p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-ink">{headline}</p>
          {sub && <p className="text-sm text-muted">{sub}</p>}
          {m.at === "shop" && m.atSite.length > 0 && (
            <p className="text-sm text-muted">
              At the site instead: <span className="font-medium text-ink">{m.atSite.join(", ")}</span>
            </p>
          )}
        </div>
      </div>

      {/* The viewer's own choice */}
      {m.onJob && m.at === "shop" && !m.locked && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => meetAtSite(m.jobId, !m.meAtSite))}
          className={`${small} self-start border border-line bg-card text-ink`}
        >
          {m.meAtSite ? "Meet at the shop instead" : "I'll meet at the site (own car)"}
        </button>
      )}

      {/* Zach or the lead: switch everyone */}
      {m.canChangeAll && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted">Everyone meets:</span>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-card p-1">
            {(
              [
                ["shop", "Shop"],
                ["site", "Site"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                disabled={pending || m.at === k}
                onClick={() => run(() => setJobMeet(m.jobId, k))}
                aria-pressed={m.at === k}
                className={`press h-8 rounded-lg px-3 text-[13px] font-semibold ${m.at === k ? "bg-primary text-white dark:text-navy" : "text-muted"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      {m.onJob && m.locked && <p className="text-xs text-muted">After 8 PM the night before, call or text Zach to change where you meet.</p>}
      {error && <p role="alert" className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
    </div>
  );
}
