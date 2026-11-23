"use client";

import { useState } from "react";
import { ROLE_LABEL, type CrewMember } from "@/lib/crew-types";
import { telUrl } from "@/lib/jobs";
import { MemberForm } from "./MemberForm";

export function CrewRow({ member, isMe, hourlyRate }: { member: CrewMember; isMe: boolean; hourlyRate: number | null }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const status = !member.active
    ? { text: "Not active", cls: "text-muted" }
    : member.user_id
      ? { text: "✓ Has logged in", cls: "text-ok" }
      : member.email
        ? { text: "Can log in", cls: "text-primary" }
        : { text: "No email yet", cls: "text-warn" };

  const detail = (label: string, value: React.ReactNode) => (
    <div className="flex gap-3 py-2">
      <dt className="w-24 shrink-0 text-sm text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-[15px] text-ink">{value}</dd>
    </div>
  );

  return (
    <li className="border-b border-line last:border-b-0">
      <button
        onClick={() => {
          setOpen(!open);
          setEditing(false);
        }}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ink">
            {member.full_name}
            {isMe && <span className="font-normal text-muted"> (you)</span>}
          </p>
          <p className="truncate text-sm text-muted">{member.email ?? member.phone ?? "No contact info"}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="rounded-full bg-bg px-2.5 py-0.5 text-xs font-semibold text-ink">{ROLE_LABEL[member.role]}</span>
          <span className={`text-xs font-medium ${status.cls}`}>{status.text}</span>
        </div>
        <span className={`shrink-0 text-lg text-muted transition-transform ${open ? "rotate-90" : ""}`} aria-hidden>
          ›
        </span>
      </button>

      {open && (
        <div className="rise px-4 pb-4">
          {editing ? (
            <MemberForm member={member} hourlyRate={hourlyRate} onDone={() => setEditing(false)} />
          ) : (
            <div className="rounded-xl bg-bg px-4">
              <dl className="divide-y divide-line">
                {detail("Name", member.full_name)}
                {detail("Email", member.email ?? <span className="text-warn">Not added yet. Needed to log in.</span>)}
                {detail(
                  "Phone",
                  member.phone ? (
                    <a href={telUrl(member.phone)} className="font-semibold text-primary">
                      {member.phone}
                    </a>
                  ) : (
                    <span className="text-muted">Not added</span>
                  ),
                )}
                {detail("Role", ROLE_LABEL[member.role])}
                {detail("Status", <span className={status.cls}>{member.active ? `Active · ${status.text.replace("✓ ", "")}` : "Not active"}</span>)}
                {detail(
                  "Hourly pay",
                  hourlyRate != null ? <span className="font-semibold tabular-nums">${Number(hourlyRate).toFixed(2)} / hr</span> : <span className="text-muted">Not set</span>,
                )}
              </dl>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="press my-3 flex h-11 w-full items-center justify-center rounded-xl bg-primary font-semibold text-white dark:text-navy"
              >
                Edit details
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
