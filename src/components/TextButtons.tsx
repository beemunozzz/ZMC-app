"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { onMyWayText, smsHref } from "@/lib/texts";

const btn = "press flex h-12 min-w-0 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold";

/** One tap: opens Messages with the customer's number and the message filled in. */
export function TextLink({
  phone,
  body,
  label,
  done,
  onTap,
  primary,
}: {
  phone: string;
  body: string;
  label: string;
  /** Shows "✓ Sent" styling (e.g. reminder already sent). */
  done?: boolean;
  onTap?: () => void;
  primary?: boolean;
}) {
  if (!phone) {
    return (
      <span className={`${btn} border border-dashed border-line text-muted`} title="Add the customer's phone first">
        {label} · no phone
      </span>
    );
  }
  return (
    <a
      href={smsHref(phone, body)}
      onClick={onTap}
      className={`${btn} ${done ? "border border-ok/40 text-ok" : primary ? "bg-primary text-white dark:text-navy" : "border border-line text-ink"}`}
    >
      {done ? `✓ ${label}` : label}
    </a>
  );
}

const DRIVES = [10, 15, 20, 30, 45, 60];

/** "On my way": pick the drive time, then Messages opens with the arrival time worked out. */
export function OnMyWay({ phone, customerName, senderName, primary }: { phone: string; customerName: string; senderName: string; primary?: boolean }) {
  const [now, setNow] = useState<Date | null>(null);
  if (!phone) return <TextLink phone="" body="" label="On my way" />;

  if (!now) {
    return (
      <button
        type="button"
        onClick={() => setNow(new Date())}
        className={`${btn} w-full ${primary ? "bg-primary text-white dark:text-navy" : "border border-line text-ink"}`}
      >
        <Icon name="truck" className="h-5 w-5" /> Text &ldquo;On my way&rdquo;
      </button>
    );
  }
  return (
    <div className="rise flex flex-col gap-2 rounded-xl border border-line p-3">
      <p className="text-sm font-medium text-ink">How long is the drive?</p>
      <div className="grid grid-cols-3 gap-2">
        {DRIVES.map((m) => (
          <a key={m} href={smsHref(phone, onMyWayText(customerName, senderName, m, now))} className={`${btn} border border-line text-ink`}>
            {m < 60 ? `${m} min` : "1 hr"}
          </a>
        ))}
      </div>
      <button type="button" onClick={() => setNow(null)} className="self-start text-sm font-medium text-muted">
        Cancel
      </button>
    </div>
  );
}
