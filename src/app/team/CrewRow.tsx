"use client";

import { useState } from "react";
import { ROLE_LABEL, type CrewMember } from "@/lib/crew-types";
import { MemberForm } from "./MemberForm";

export function CrewRow({ member, isMe }: { member: CrewMember; isMe: boolean }) {
  const [open, setOpen] = useState(false);

  const status = !member.active
    ? { text: "Not active", cls: "text-muted" }
    : member.user_id
      ? { text: "✓ Has logged in", cls: "text-[#2F6B45] dark:text-[#8FD3A6]" }
      : member.email
        ? { text: "Can log in", cls: "text-primary" }
        : { text: "No email yet", cls: "text-[#A4541A] dark:text-[#F0B27A]" };

  return (
    <li className="border-b border-line last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
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
      </button>
      {open && (
        <div className="rise px-4 pb-4">
          <MemberForm member={member} onDone={() => setOpen(false)} />
        </div>
      )}
    </li>
  );
}
