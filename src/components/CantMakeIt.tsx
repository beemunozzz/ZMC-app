"use client";

import { useActionState, useState } from "react";
import { cancelCover, requestCover, type AvailState } from "@/app/availability/actions";
import { smsHref } from "@/lib/texts";

/** Crew on a job: "Can't make this job?" Tells Zach so he can find cover. */
export function CantMakeIt({
  jobId,
  jobLabel,
  zachPhone,
  open,
}: {
  jobId: string;
  /** e.g. "Fri, Nov 28 · Maria Lopez" */
  jobLabel: string;
  zachPhone: string;
  /** An open request already sent for this job. */
  open: { id: string; reason: string } | null;
}) {
  const [state, action, pending] = useActionState<AvailState, FormData>(requestCover, {});
  const [show, setShow] = useState(false);
  const [reason, setReason] = useState("");
  const text = `Hi Zach, I can't make the job on ${jobLabel}.${reason ? ` ${reason}.` : ""} I sent a cover request in the app.`;

  if (open || state.ok) {
    return (
      <div className="flex flex-col gap-2 rounded-xl bg-warn/12 p-3 text-sm text-warn">
        <p>
          <b>You told Zach you can&apos;t make this job.</b> You&apos;re still on it until he finds cover.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href={smsHref(zachPhone, text)} className="press flex h-10 items-center rounded-xl bg-warn px-3 font-semibold text-white dark:text-navy">
            Text Zach
          </a>
          {open && (
            <form action={cancelCover}>
              <input type="hidden" name="id" value={open.id} />
              <input type="hidden" name="job_id" value={jobId} />
              <button className="press h-10 rounded-xl border border-warn/40 px-3 font-semibold">I can make it after all</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (!show) {
    return (
      <button type="button" onClick={() => setShow(true)} className="self-start text-sm font-semibold text-bad">
        Can&apos;t make this job?
      </button>
    );
  }
  return (
    <form action={action} className="rise flex flex-col gap-2 rounded-xl border border-bad/30 p-3">
      <input type="hidden" name="job_id" value={jobId} />
      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        What&apos;s going on? <span className="font-normal text-muted">(optional)</span>
        <input
          name="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. doctor appointment"
          className="h-12 w-full rounded-xl border border-line bg-bg px-3 text-base text-ink outline-none focus:border-primary"
          autoComplete="off"
        />
      </label>
      {state.error && <p className="text-sm text-bad">{state.error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className="press h-12 flex-1 rounded-xl bg-bad font-semibold text-white disabled:opacity-60 dark:text-navy">
          {pending ? "Sending…" : "Tell Zach I can't make it"}
        </button>
        <button type="button" onClick={() => setShow(false)} className="press h-12 rounded-xl border border-line px-4 font-semibold text-ink">
          Cancel
        </button>
      </div>
    </form>
  );
}
