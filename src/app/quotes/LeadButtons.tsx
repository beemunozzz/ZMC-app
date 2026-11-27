"use client";

import { smsHref } from "@/lib/texts";
import { markContacted } from "./lead-actions";

const tel = (p: string) => `tel:${p.replace(/[^0-9+]/g, "")}`;

/** Call or text a new lead. Either one counts as the first reply and stops the "no reply yet" timer. */
export function LeadButtons({ id, phone, name }: { id: string; phone: string; name: string }) {
  if (!phone) return <span className="text-xs text-muted">No phone yet</span>;
  const first = name.replace(/^example:\s*/i, "").trim().split(/\s+/)[0] || "there";
  const hello = `Hi ${first}, this is Zach with Zachery's Moving Co. Thanks for reaching out about your move! When are you moving, and where from and to?`;
  const btn = "press flex h-9 flex-1 items-center justify-center rounded-lg border border-line bg-card text-sm font-semibold text-primary";
  return (
    <div className="flex gap-2">
      <a href={tel(phone)} onClick={() => void markContacted(id)} className={btn}>
        Call
      </a>
      <a href={smsHref(phone, hello)} onClick={() => void markContacted(id)} className={btn}>
        Text
      </a>
    </div>
  );
}
