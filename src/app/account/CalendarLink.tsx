"use client";

import { useState, useTransition } from "react";
import { calendarLink } from "./calendar-actions";

/** "Add my jobs to my calendar": a private link the phone's own calendar keeps checking for new and changed jobs. */
export function CalendarLink({ host, initial }: { host: string; initial: string | null }) {
  const [token, setToken] = useState(initial);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pending, start] = useTransition();

  const get = (reset: boolean) =>
    start(async () => {
      const r = await calendarLink(reset);
      if (r.error) setError(r.error);
      else {
        setToken(r.token ?? null);
        setConfirmReset(false);
      }
    });

  const path = token ? `${host}/api/cal/${token}.ics` : "";
  const webcal = `webcal://${path}`;
  const google = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`;
  const btn = "press flex h-12 items-center justify-center rounded-xl text-[15px] font-semibold";

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <div>
        <h2 className="text-[17px] font-semibold text-ink">My jobs in my calendar</h2>
        <p className="text-sm text-muted">Your ZMC jobs show up in your phone&apos;s calendar and update by themselves.</p>
      </div>
      {!token ? (
        <button type="button" onClick={() => get(false)} disabled={pending} className={`${btn} bg-primary text-white disabled:opacity-60 dark:text-navy`}>
          {pending ? "Making your link…" : "Add my jobs to my calendar"}
        </button>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <a href={webcal} className={`${btn} bg-primary text-white dark:text-navy`}>
              iPhone
            </a>
            <a href={google} target="_blank" rel="noreferrer" className={`${btn} border border-line text-ink`}>
              Google
            </a>
          </div>
          <p className="text-xs text-muted">
            iPhone: tap <b>iPhone</b>, then <b>Subscribe</b>. Android: tap <b>Google</b> and <b>Add</b>. New jobs can take a few hours to appear.
          </p>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`https://${path}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  /* nothing to do */
                }
              }}
              className="text-sm font-semibold text-primary"
            >
              {copied ? "Copied ✓" : "Copy link"}
            </button>
            {confirmReset ? (
              <span className="flex items-center gap-3 text-sm">
                <button type="button" onClick={() => get(true)} disabled={pending} className="font-semibold text-bad">
                  Yes, new link
                </button>
                <button type="button" onClick={() => setConfirmReset(false)} className="font-semibold text-muted">
                  Cancel
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmReset(true)} className="text-sm font-semibold text-muted">
                Reset link
              </button>
            )}
          </div>
          {confirmReset && <p className="text-xs text-muted">The old link stops working. Add the new one to your calendar again.</p>}
          <p className="text-xs text-muted">Keep this link to yourself: anyone with it can see your job times and addresses.</p>
        </>
      )}
      {error && <p role="alert" className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
    </section>
  );
}
