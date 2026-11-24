"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ROLE_LABEL, type Role } from "@/lib/crew-types";
import { HouseFields } from "@/components/HouseFields";
import { JOB_TYPES, STATUS, type Job } from "@/lib/jobs";
import { REFER_ITEMS } from "@/lib/pricing";
import { AVAIL_STYLE, availabilityFor, type JobSlot, type TimeOff } from "@/lib/availability";
import type { Week } from "@/lib/regular";
import { deleteJob, saveJob, type JobFormState } from "./actions";

type CrewOption = { id: string; full_name: string; role: Role };

const input =
  "h-12 w-full min-w-0 rounded-xl border border-line bg-bg px-3 text-base text-ink outline-none focus:border-primary";
const label = "flex min-w-0 flex-col gap-1 text-sm font-medium text-ink";
const section = "flex flex-col gap-3 rounded-2xl border border-line bg-card p-4";
const heading = "font-display text-lg font-extrabold uppercase text-ink";


export type CrewAvailabilityData = { timeOff: TimeOff[]; jobs: JobSlot[]; regular?: Record<string, Week> };

export function JobForm({ job, crew, defaultDate, avail }: { job?: Job; crew: CrewOption[]; defaultDate: string; avail?: CrewAvailabilityData }) {
  const [when, setWhen] = useState({
    date: job?.job_date ?? defaultDate,
    start: job?.start_time?.slice(0, 5) ?? "08:00",
    hours: job?.est_hours != null ? String(job.est_hours) : "",
  });
  const availOf = (id: string) => (avail ? availabilityFor(id, when.date, when.start, Number(when.hours) || 2, avail.timeOff, avail.jobs, job?.id, avail.regular) : null);
  const [state, action, pending] = useActionState<JobFormState, FormData>(saveJob, {});
  const [lead, setLead] = useState(job?.lead_id ?? "");
  const [picked, setPicked] = useState<string[]>(job?.crew_ids ?? []);
  const [movers, setMovers] = useState(job?.movers_needed ?? 2);
  const [stories, setStories] = useState({ p: job?.pickup_house.stories ?? "", d: job?.dropoff_house.stories ?? "" });
  const [special, setSpecial] = useState(`${job?.heavy_items ?? ""} ${job?.notes ?? ""}`);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const assigned = (lead ? 1 : 0) + picked.filter((id) => id !== lead).length;
  const twoStory = Number(stories.p) >= 2 || Number(stories.d) >= 2;
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4">
        {job && <input type="hidden" name="id" value={job.id} />}

        {/* 1. Date and start time */}
        <section className={section}>
          <h2 className={heading}>When</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              Date
              <input type="date" name="job_date" required value={when.date} onChange={(e) => setWhen((w) => ({ ...w, date: e.target.value }))} className={input} />
            </label>
            <label className={label}>
              Start time
              <input type="time" name="start_time" value={when.start} onChange={(e) => setWhen((w) => ({ ...w, start: e.target.value }))} className={input} />
            </label>
          </div>
        </section>

        {/* 2. Pickup address, then its house details */}
        <section className={section}>
          <h2 className={heading}>Pickup</h2>
          <label className={label}>
            Pickup address
            <input name="pickup_address" defaultValue={job?.pickup_address} placeholder="Street, city" className={input} autoComplete="off" />
          </label>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">House at pickup</p>
          <HouseFields prefix="pickup" house={job?.pickup_house ?? {}} onStories={(v) => setStories((s) => ({ ...s, p: v }))} />
        </section>

        {/* 3. Drop-off address, then its house details */}
        <section className={section}>
          <h2 className={heading}>Drop-off</h2>
          <label className={label}>
            Drop-off address
            <input name="dropoff_address" defaultValue={job?.dropoff_address} placeholder="Street, city" className={input} autoComplete="off" />
          </label>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">House at drop-off</p>
          <HouseFields prefix="dropoff" house={job?.dropoff_house ?? {}} onStories={(v) => setStories((s) => ({ ...s, d: v }))} />
        </section>

        {/* 4. Customer */}
        <section className={section}>
          <h2 className={heading}>Customer</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>
              Name
              <input name="customer_name" required defaultValue={job?.customer_name} className={input} autoComplete="off" />
            </label>
            <label className={label}>
              Phone
              <input name="customer_phone" type="tel" inputMode="tel" defaultValue={job?.customer_phone} className={input} autoComplete="off" />
            </label>
          </div>
        </section>

        {/* 5. Type of job, truck, status */}
        <section className={section}>
          <h2 className={heading}>The job</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={label}>
              Type of job
              <select name="job_type" defaultValue={job?.job_type ?? "Full move"} className={input}>
                {JOB_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className={label}>
              Truck
              <select name="truck" defaultValue={job?.truck ?? "ours"} className={input}>
                <option value="ours">We bring ours</option>
                <option value="theirs">Customer has their own</option>
              </select>
            </label>
            <label className={label}>
              Status
              <select name="status" defaultValue={job?.status ?? "booked"} className={input}>
                {Object.entries(STATUS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {/* 6. Hours and crew */}
        <section className={section}>
          <h2 className={heading}>Hours and crew</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              Estimated hours
              <input
                name="est_hours"
                type="number"
                inputMode="decimal"
                min={0}
                max={24}
                step={0.5}
                value={when.hours}
                onChange={(e) => setWhen((w) => ({ ...w, hours: e.target.value }))}
                placeholder="e.g. 4"
                className={input}
              />
            </label>
            <label className={label}>
              Crew needed
              <select name="movers_needed" value={movers} onChange={(e) => setMovers(Number(e.target.value))} className={input}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "person" : "people"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className={label}>
            Not-to-exceed price ($)
            <input
              name="nte"
              type="number"
              inputMode="decimal"
              min={0}
              step={10}
              defaultValue={job?.nte ?? ""}
              placeholder="California requires one on hourly moves"
              className={input}
            />
          </label>
          {twoStory && movers < 3 && (
            <p className="rounded-xl bg-warn/12 px-3 py-2 text-sm text-warn">Two-story home: think about a 3rd mover.</p>
          )}

          <label className={label}>
            Crew lead
            <select name="lead_id" value={lead} onChange={(e) => setLead(e.target.value)} className={input}>
              <option value="">Choose a crew lead</option>
              {crew.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} ({ROLE_LABEL[c.role]})
                  {(() => {
                    const a = availOf(c.id);
                    return a && a.kind !== "free" ? ` · ${AVAIL_STYLE[a.kind].icon} ${a.text}` : "";
                  })()}
                </option>
              ))}
            </select>
          </label>
          {lead && (() => {
            const a = availOf(lead);
            return a && a.kind !== "free" ? (
              <p className={`rounded-xl px-3 py-2 text-sm ${a.kind === "off" ? "bg-bad/10 text-bad" : "bg-warn/12 text-warn"}`}>
                {AVAIL_STYLE[a.kind].icon} Crew lead: {a.text}
              </p>
            ) : null;
          })()}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-ink">Movers on this job</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {crew
                .filter((c) => c.id !== lead)
                .map((c) => {
                  const a = availOf(c.id);
                  return (
                  <label
                    key={c.id}
                    className={`press flex min-h-14 min-w-0 cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 text-[15px] ${
                      picked.includes(c.id) ? "border-primary bg-primary/10 font-semibold text-ink" : "border-line text-ink"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="crew_ids"
                      value={c.id}
                      checked={picked.includes(c.id)}
                      onChange={() => toggle(c.id)}
                      className="h-4 w-4 shrink-0 accent-[var(--primary)]"
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{c.full_name}</span>
                      {a && (
                        <span className={`truncate text-xs font-medium ${AVAIL_STYLE[a.kind].cls}`}>
                          {AVAIL_STYLE[a.kind].icon} {a.text}
                        </span>
                      )}
                    </span>
                  </label>
                  );
                })}
            </div>
            <p className={`text-sm tabular-nums ${assigned < movers ? "text-warn" : "text-ok"}`}>
              {assigned < movers ? `⚠ ${assigned} of ${movers} assigned. ${movers - assigned} more needed.` : `✓ ${assigned} of ${movers} assigned`}
            </p>
          </fieldset>
        </section>

        {/* Meeting up */}
        <section className={section}>
          <h2 className={heading}>Meeting up</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              Crew meets
              <select name="meet_at" defaultValue={job?.meet_at ?? "shop"} className={input}>
                <option value="shop">At the shop</option>
                <option value="site">At the job site</option>
              </select>
            </label>
            <label className={label}>
              Drive from shop (min)
              <input name="drive_min" type="number" inputMode="numeric" min={0} max={600} defaultValue={job?.drive_min ?? ""} placeholder="Auto" className={input} />
            </label>
          </div>
          <p className="text-xs text-muted">
            Meet time at the shop = start time − drive − the buffer on the Prices page. Leave the drive blank to work it out from the addresses.
          </p>
        </section>

        {/* 7. Notes */}
        <section className={section}>
          <h2 className={heading}>Notes</h2>
          <label className={label}>
            Heavy or special items
            <input
              name="heavy_items"
              defaultValue={job?.heavy_items}
              placeholder="e.g. gun safe, treadmill"
              className={input}
              autoComplete="off"
              onChange={(e) => setSpecial(e.target.value)}
            />
          </label>
          {REFER_ITEMS.test(special) && (
            <p className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">
              ⚠ ZMC doesn&apos;t move pianos or hot tubs. Refer the customer to a partner mover for that item.
            </p>
          )}
          <label className={label}>
            Notes for the crew
            <textarea
              name="notes"
              defaultValue={job?.notes}
              rows={4}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-base text-ink outline-none focus:border-primary"
            />
          </label>
          <label className={label}>
            <span>
              Extra things to bring <span className="font-normal text-muted">(this job only, one per line)</span>
            </span>
            <textarea
              name="load_extra"
              defaultValue={job?.load_extra ?? ""}
              rows={2}
              placeholder={"e.g. TV boxes\nExtra ratchet straps"}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-base text-ink outline-none focus:border-primary"
            />
          </label>
          <p className="-mt-1 text-xs text-muted">They&apos;re added to the crew&apos;s &ldquo;Before you leave&rdquo; checklist. The everyday list is on ☰ → Prices.</p>
        </section>

        {state.error && (
          <p role="alert" className="rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">
            {state.error}
          </p>
        )}

        <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur">
          <button
            disabled={pending}
            className="press flex h-12 flex-1 items-center justify-center rounded-xl bg-primary font-semibold text-white disabled:opacity-60 dark:text-navy"
          >
            {pending ? "Saving…" : job ? "Save changes" : "Add to schedule"}
          </button>
          <Link
            href={job ? `/jobs/${job.id}` : "/"}
            className="press flex h-12 items-center justify-center rounded-xl border border-line px-5 font-semibold text-ink"
          >
            Cancel
          </Link>
        </div>
      </form>

      {job && (
        <form action={deleteJob} className="flex flex-col gap-2 pb-6">
          <input type="hidden" name="id" value={job.id} />
          <input type="hidden" name="job_date" value={job.job_date} />
          {confirmDelete ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-bad/10 p-3">
              <span className="text-sm font-medium text-bad">Delete this job for everyone? This can&apos;t be undone.</span>
              <div className="flex gap-2">
                <button className="press h-11 rounded-xl bg-bad px-4 text-sm font-semibold text-white dark:text-navy">Yes, delete</button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="press h-11 rounded-xl border border-line px-4 text-sm font-semibold text-ink">
                  Keep it
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="self-start text-sm font-semibold text-bad">
              Delete job
            </button>
          )}
        </form>
      )}
    </div>
  );
}
