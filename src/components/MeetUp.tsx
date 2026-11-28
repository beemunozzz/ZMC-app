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
  /** At the job this many minutes before the start ("8:55 AM"). */
  arriveBy: string;
  early: number;
  /** The viewer's own "leave home by" (from their home address), and how it was worked out. */
  homeLeave: string;
  homeDriveText: string;
  /** On the job but no home address in My info yet. */
  needsHome: boolean;
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
    m.at === "site"
      ? `Meet at the job site${m.arriveBy ? ` · ${m.arriveBy}` : ""}`
      : mine
        ? `You meet at the site${m.arriveBy ? ` · ${m.arriveBy}` : ""}`
        : `Meet at the shop${m.time ? ` · ${m.time}` : ""}`;
  const sub =
    m.at === "site" || mine
      ? `${mine ? "Own car. " : "Everyone drives to the pickup address. "}Be there ${m.early} minutes before the ${m.start} start.`
      : [m.driveText, m.leave && `truck leaves ${m.leave}`, m.arriveBy && `at the job ${m.arriveBy}`].filter(Boolean).join(" · ");

  const small = "press h-10 rounded-xl px-3 text-sm font-semibold disabled:opacity-60";

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-bg p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-ink">{headline}</p>
          {sub && <p className="text-sm text-muted">{sub}</p>}
          {m.homeLeave && (
            <p className="mt-1 text-[15px] font-semibold text-primary">
              🏠 Leave home by {m.homeLeave}
              <span className="block text-xs font-normal text-muted">{m.homeDriveText} (estimate until Google Maps is set up)</span>
            </p>
          )}
          {m.needsHome && (
            <p className="mt-1 text-sm text-muted">
              <a href="/my-info" className="font-semibold text-primary">
                Add your home address
              </a>{" "}
              to see what time to leave home.
            </p>
          )}
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
