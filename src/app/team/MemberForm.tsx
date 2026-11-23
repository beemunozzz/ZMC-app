"use client";

import { useActionState } from "react";
import type { CrewMember } from "@/lib/crew-types";
import { addMember, updateMember, type FormState } from "./actions";

const input =
  "h-11 w-full rounded-xl border border-line bg-bg px-3 text-base text-ink outline-none focus:border-primary";
const label = "flex flex-col gap-1 text-sm font-medium text-ink";

export function MemberForm({ member, hourlyRate, onDone }: { member?: CrewMember; hourlyRate?: number | null; onDone?: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    async (prev, form) => {
      const result = await (member ? updateMember : addMember)(prev, form);
      if (result.ok && onDone) onDone();
      return result;
    },
    {},
  );

  return (
    <form action={action} key={member ? undefined : state.ok} className="flex flex-col gap-3">
      {member && <input type="hidden" name="id" value={member.id} />}
      <label className={label}>
        Name
        <input className={input} name="full_name" required defaultValue={member?.full_name} autoComplete="off" />
      </label>
      <label className={label}>
        Email <span className="font-normal text-muted">(they log in with this)</span>
        <input
          className={input}
          name="email"
          type="email"
          inputMode="email"
          defaultValue={member?.email ?? ""}
          placeholder="Leave blank if you don't have it yet"
          autoComplete="off"
        />
      </label>
      <label className={label}>
        Phone
        <input className={input} name="phone" type="tel" inputMode="tel" defaultValue={member?.phone ?? ""} autoComplete="off" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          Role
          <select className={input} name="role" defaultValue={member?.role ?? "mover"}>
            <option value="mover">Mover</option>
            <option value="lead">Crew lead</option>
            <option value="owner">Owner</option>
          </select>
        </label>
        {member && (
          <label className={label}>
            Status
            <select className={input} name="active" defaultValue={member.active ? "on" : "off"}>
              <option value="on">Active</option>
              <option value="off">Not active</option>
            </select>
          </label>
        )}
      </div>
      <label className={label}>
        Hourly pay <span className="font-normal text-muted">(only the owner sees this)</span>
        <div className="flex items-center gap-2">
          <span className="text-muted">$</span>
          <input
            className={`${input} max-w-32 tabular-nums`}
            name="hourly_rate"
            type="number"
            inputMode="decimal"
            min={0}
            step={0.5}
            defaultValue={hourlyRate ?? ""}
            placeholder="e.g. 22"
          />
          <span className="text-sm text-muted">per hour</span>
        </div>
      </label>

      {state.error && (
        <p role="alert" className="rounded-xl bg-[#B3261E]/10 px-3 py-2 text-sm text-[#B3261E] dark:text-[#F2B8B5]">
          {state.error}
        </p>
      )}
      {state.ok && !member && <p className="text-sm font-medium text-[#2F6B45] dark:text-[#8FD3A6]">✓ {state.ok}</p>}

      <button
        disabled={pending}
        className="press flex h-12 items-center justify-center rounded-xl bg-primary font-semibold text-white disabled:opacity-60 dark:text-navy"
      >
        {pending ? "Saving…" : member ? "Save changes" : "Add to crew"}
      </button>
    </form>
  );
}
