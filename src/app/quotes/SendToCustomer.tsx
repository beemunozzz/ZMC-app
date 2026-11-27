"use client";

import { useState, useTransition } from "react";
import { smsHref } from "@/lib/texts";
import { sendQuoteLink, type SendResult } from "./send-actions";

const when = (ts: string) =>
  new Date(ts).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Owner: make the customer's private link and a ready-to-send text with it. */
export function SendToCustomer({
  quoteId,
  phone,
  sentAt,
  acceptedAt,
  signedName,
}: {
  quoteId: string;
  phone: string;
  sentAt: string | null;
  acceptedAt: string | null;
  signedName: string | null;
}) {
  const [res, setRes] = useState<SendResult | null>(null);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  const make = () =>
    start(async () => {
      setCopied(false);
      setRes(await sendQuoteLink(quoteId));
    });

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <h2 className="font-display text-lg font-extrabold uppercase text-ink">Send to customer</h2>
      {acceptedAt ? (
        <p className="rounded-xl bg-ok/12 px-3 py-2 text-sm font-medium text-ok">
          ✓ Signed and booked online by {signedName || "the customer"} on {when(acceptedAt)}. The job is on the schedule.
        </p>
      ) : (
        <p className="text-sm text-muted">
          Makes a private link to this estimate. The customer can save it as a PDF, sign with a finger, and book.
          {sentAt ? ` Last sent ${when(sentAt)}.` : ""} Save the quote first so the link has your latest changes.
        </p>
      )}

      <button
        type="button"
        onClick={make}
        disabled={pending}
        className="press h-12 rounded-xl bg-primary font-semibold text-white disabled:opacity-60 dark:text-navy"
      >
        {pending ? "Making the link…" : acceptedAt ? "Show the customer's link" : sentAt ? "Update the link and text" : "Create customer link"}
      </button>

      {res?.error && <p role="alert" className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{res.error}</p>}
      {res?.text && (
        <div className="flex flex-col gap-2">
          <p className="whitespace-pre-wrap break-words rounded-xl bg-bg p-3 text-sm text-ink select-all">{res.text}</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(res.text!);
                  setCopied(true);
                } catch {
                  /* press and hold the text to copy */
                }
              }}
              className="press h-11 rounded-xl border border-line text-sm font-semibold text-ink"
            >
              {copied ? "Copied ✓" : "Copy text"}
            </button>
            {phone ? (
              <a href={smsHref(phone, res.text)} className="press flex h-11 items-center justify-center rounded-xl border border-line text-sm font-semibold text-ink">
                Text it
              </a>
            ) : (
              <span className="flex h-11 items-center justify-center rounded-xl border border-dashed border-line text-xs text-muted">No phone</span>
            )}
            <a href={res.url} target="_blank" rel="noreferrer" className="press flex h-11 items-center justify-center rounded-xl border border-line text-sm font-semibold text-primary">
              Open link
            </a>
          </div>
          <p className="text-xs text-muted">The link works for 14 days. Our costs and the &ldquo;Our side&rdquo; numbers are never on it.</p>
        </div>
      )}
    </section>
  );
}
