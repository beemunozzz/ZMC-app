"use client";

import { useState } from "react";
import { smsHref } from "@/lib/texts";
import { logFollowup } from "./followup-actions";

/** Text a follow-up (opens Messages with it written) and count it. */
export function FollowUpButton({ id, phone, text, label = "Text follow-up", small }: { id: string; phone: string; text: string; label?: string; small?: boolean }) {
  const [sent, setSent] = useState(false);
  if (!phone) return <span className="text-xs text-muted">No phone on file</span>;
  return (
    <a
      href={smsHref(phone, text)}
      onClick={() => {
        setSent(true);
        void logFollowup(id);
      }}
      className={`press flex items-center justify-center rounded-xl font-semibold ${
        small ? "h-9 border border-line bg-card px-3 text-sm text-primary" : "h-11 bg-primary px-4 text-white dark:text-navy"
      }`}
    >
      {sent ? "✓ Sent" : label}
    </a>
  );
}
