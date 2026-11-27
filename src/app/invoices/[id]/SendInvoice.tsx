"use client";

import { useState, useTransition } from "react";
import { smsHref } from "@/lib/texts";
import { sendInvoiceLink, type InvoiceSendResult } from "../send-actions";

const when = (ts: string) =>
  new Date(ts).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const btn = "press flex h-11 items-center justify-center rounded-xl border border-line text-sm font-semibold text-ink";

/** Make the customer's private invoice link, then text it, email it or copy it. */
export function SendInvoice({ invoiceId, phone, sentAt }: { invoiceId: string; phone: string; sentAt: string | null }) {
  const [res, setRes] = useState<InvoiceSendResult | null>(null);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");

  const make = () =>
    start(async () => {
      setCopied(false);
      setRes(await sendInvoiceLink(invoiceId));
    });

  const mailto = res?.text
    ? `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(res.subject ?? "Your invoice")}&body=${encodeURIComponent(res.text)}`
    : "";

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <h2 className="font-display text-lg font-extrabold uppercase text-ink">Send to customer</h2>
      <p className="text-sm text-muted">
        Makes a private link to this invoice, same look as the estimate. The customer can save it as a one-page PDF.
        {sentAt ? ` Last sent ${when(sentAt)}.` : ""}
      </p>

      <button
        type="button"
        onClick={make}
        disabled={pending}
        className="press h-12 rounded-xl bg-primary font-semibold text-white disabled:opacity-60 dark:text-navy"
      >
        {pending ? "Making the link…" : sentAt || res ? "Update the link and message" : "Create invoice link"}
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
              className={btn}
            >
              {copied ? "Copied ✓" : "Copy text"}
            </button>
            {phone ? (
              <a href={smsHref(phone, res.text)} className={btn}>
                Text it
              </a>
            ) : (
              <span className="flex h-11 items-center justify-center rounded-xl border border-dashed border-line text-xs text-muted">No phone</span>
            )}
            <a href={res.url} target="_blank" rel="noreferrer" className={`${btn} text-primary`}>
              Open link
            </a>
          </div>

          <label className="mt-1 flex flex-col gap-1 text-sm font-medium text-ink">
            Customer&apos;s email (to email it)
            <div className="flex gap-2">
              <input
                type="email"
                inputMode="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 text-base text-ink outline-none focus:border-primary"
              />
              <a href={mailto} className={`${btn} shrink-0 px-4`}>
                Email it
              </a>
            </div>
          </label>
          <p className="text-xs text-muted">Text it and Email it open your phone&apos;s Messages or Mail app with everything filled in. You press send. Our costs are never on the link.</p>
        </div>
      )}
    </section>
  );
}
