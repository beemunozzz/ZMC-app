"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { swapCrew } from "@/app/jobs/swap-actions";
import { AVAIL_STYLE } from "@/lib/availability";
import { ALERT_HOURS } from "@/lib/hours-alert";
import type { Candidate } from "@/lib/swap";
import { Icon } from "./Icon";

type Member = { id: string; name: string; phone: string | null; isLead: boolean };

const hrs = (n: number) => String(Math.round(n * 100) / 100);
const tel = (p: string) => `tel:${p.replace(/[^0-9+]/g, "")}`;

/**
 * Zach's crew list on a job: Swap anyone out, or add someone to an open spot. The list of people shows
 * who's free that day and their hours that week (fewest first), so it's easy to give hours to someone low.
 */
export function CrewSwap({ jobId, members, candidates, short, needed }: { jobId: string; members: Member[]; candidates: Candidate[]; short: number; needed: number }) {
  const router = useRouter();
  const [mode, setMode] = useState<{ out: string | null } | null>(null);
  const [picked, setPicked] = useState<Candidate | null>(null); // waiting for "who leads?"
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const out = mode?.out ? members.find((m) => m.id === mode.out) : null;
  const hasLead = members.some((m) => m.isLead);
  const needsLeadPick = (out?.isLead ?? false) || (!mode?.out && !hasLead);

  const close = () => {
    setMode(null);
    setPicked(null);
    setError("");
  };
  const save = (inId: string, leadId?: string | null) =>
    start(async () => {
      setError("");
      const res = await swapCrew(jobId, mode?.out ?? null, inId, leadId);
      if (res.error) setError(res.error);
      else {
        close();
        router.refresh();
      }
    });
  const pick = (c: Candidate) => (needsLeadPick ? setPicked(c) : save(c.id));

  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <h2 className="font-display text-lg font-extrabold uppercase text-ink">
        Crew <span className="tabular-nums text-muted">({members.length} of {needed})</span>
      </h2>

      {members.length ? (
        <ul className="mt-2 flex flex-col gap-1">
          {members.map((m) => (
            <li key={m.id} className={`flex items-center gap-3 rounded-xl py-1.5 text-[15px] ${mode?.out === m.id ? "bg-warn/10 px-2" : ""}`}>
              <span className="min-w-0 flex-1 break-words text-ink">
                {m.isLead ? (
                  <b className="inline-flex items-center gap-1">
                    <Icon name="star" filled className="h-4 w-4 text-tape" /> {m.name}
                  </b>
                ) : (
                  m.name
                )}
                {m.isLead && <span className="text-muted"> · crew lead</span>}
                {m.phone && (
                  <a href={tel(m.phone)} className="block text-sm font-semibold text-primary">
                    {m.phone}
                  </a>
                )}
              </span>
              <button
                type="button"
                onClick={() => (mode?.out === m.id ? close() : (setMode({ out: m.id }), setPicked(null), setError("")))}
                className="press h-10 shrink-0 rounded-xl border border-line px-3 text-sm font-semibold text-primary"
              >
                {mode?.out === m.id ? "Cancel" : "Swap"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted">Nobody assigned yet.</p>
      )}
      {short > 0 && members.length > 0 && <p className="mt-2 text-sm font-semibold text-bad">Need {short} more.</p>}

      {!mode && (short > 0 || !members.length) && (
        <button
          type="button"
          onClick={() => setMode({ out: null })}
          className="press mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-primary font-semibold text-white dark:text-navy"
        >
          <Icon name="plus" className="h-4 w-4" /> Add someone
        </button>
      )}

      {mode && (
        <div className="rise mt-3 flex flex-col gap-2 border-t border-line pt-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-ink">{out ? `Swap out ${out.name} for…` : "Add to this job…"}</p>
            <button type="button" onClick={close} className="text-sm font-semibold text-muted">
              Cancel
            </button>
          </div>

          {picked ? (
            <div className="flex flex-col gap-2 rounded-xl bg-bg p-3">
              <p className="text-sm text-ink">
                {out ? <>{out.name} was the crew lead. </> : null}
                <b>Who leads this job?</b>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[{ id: picked.id, name: picked.name }, ...members.filter((m) => m.id !== mode.out).map((m) => ({ id: m.id, name: m.name }))].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={pending}
                    onClick={() => save(picked.id, p.id)}
                    className="press h-11 rounded-xl border border-line bg-card px-2 text-sm font-semibold text-ink disabled:opacity-50"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setPicked(null)} className="self-start text-sm font-semibold text-muted">
                ‹ Pick someone else
              </button>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {candidates.map((c) => {
                const st = AVAIL_STYLE[c.avail.kind];
                const low = c.weekHours <= ALERT_HOURS;
                return (
                  <li key={c.id} className={`flex items-center gap-3 py-2 ${c.ok ? "" : "opacity-50"}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-ink">
                        {c.name}
                        {c.role === "lead" && <span className="ml-1.5 rounded-full bg-tape/20 px-1.5 py-px text-[10px] font-semibold uppercase text-ink">Lead</span>}
                      </p>
                      <p className="text-xs tabular-nums">
                        <span className={st.cls}>
                          {st.icon} {c.avail.text}
                        </span>
                        <span className={low ? "font-semibold text-warn" : "text-muted"}> · {hrs(c.weekHours)} hrs this week</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!c.ok || pending}
                      onClick={() => pick(c)}
                      className="press h-10 shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:bg-line disabled:text-muted dark:text-navy"
                    >
                      Pick
                    </button>
                  </li>
                );
              })}
              {!candidates.length && <li className="py-2 text-sm text-muted">Everyone is already on this job.</li>}
            </ul>
          )}
          {error && <p role="alert" className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
          {pending && <p className="text-sm text-muted">Saving…</p>}
          <p className="text-xs text-muted">Free people with the fewest hours are at the top. Both people get a notification.</p>
        </div>
      )}
    </section>
  );
}
