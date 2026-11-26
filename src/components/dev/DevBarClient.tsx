"use client";

import { useTransition } from "react";
import { setViewAs } from "./actions";

export type DevPerson = { id: string; full_name: string; role: "owner" | "lead" | "mover"; employment: string };

type View = "me" | "owner" | "lead" | "mover" | "on_call";
const kindOf = (p: DevPerson | null): View =>
  !p ? "me" : p.role === "owner" ? "owner" : p.role === "lead" ? "lead" : p.employment === "on_call" ? "on_call" : "mover";
const LABEL: Record<View, string> = { me: "Me", owner: "Owner", lead: "Lead", mover: "Mover", on_call: "On call" };

/** Developer tool: switch between your own view and what an owner, lead, mover or on-call person sees. */
export function DevBarClient({ people, current }: { people: DevPerson[]; current: DevPerson | null }) {
  const [pending, start] = useTransition();
  const go = (id: string) => start(() => setViewAs(id));
  const first = (k: View) => people.find((p) => kindOf(p) === k);
  const active = kindOf(current);
  const views: View[] = ["me", "owner", "lead", "mover", "on_call"];

  return (
    <div className={`border-b text-xs ${current ? "border-tape/50 bg-tape/20" : "border-line bg-card"}`}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-1.5 px-4 py-1.5">
        <span className="font-semibold uppercase tracking-wider text-muted">View as</span>
        <div className="flex rounded-lg bg-bg p-0.5" role="group" aria-label="View as">
          {views.map((k) => {
            const target = k === "me" ? null : first(k);
            if (k !== "me" && !target) return null;
            return (
              <button
                key={k}
                type="button"
                disabled={pending}
                aria-pressed={active === k}
                onClick={() => go(target?.id ?? "")}
                className={`press h-7 rounded-md px-2 font-semibold disabled:opacity-60 ${active === k ? "bg-primary text-white dark:text-navy" : "text-muted"}`}
              >
                {LABEL[k]}
              </button>
            );
          })}
        </div>
        <select
          aria-label="View as a specific person"
          disabled={pending}
          value={current?.id ?? ""}
          onChange={(e) => go(e.target.value)}
          className="h-7 min-w-0 max-w-40 rounded-md border border-line bg-bg px-1.5 font-medium text-ink"
        >
          <option value="">Me (Developer)</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name} · {LABEL[kindOf(p)]}
            </option>
          ))}
        </select>
        {current && (
          <span className="w-full font-medium text-ink sm:w-auto">
            Seeing {current.full_name.split(" ")[0]}&apos;s view · <b>read-only</b>
          </span>
        )}
      </div>
    </div>
  );
}
