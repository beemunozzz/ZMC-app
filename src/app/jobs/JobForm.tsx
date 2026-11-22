"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ROLE_LABEL, type Role } from "@/lib/crew-types";
import { HouseFields } from "@/components/HouseFields";
import { JOB_TYPES, STATUS, type Job } from "@/lib/jobs";
import { REFER_ITEMS } from "@/lib/pricing";
import { deleteJob, saveJob, type JobFormState } from "./actions";

type CrewOption = { id: string; full_name: string; role: Role };

const input =
  "h-12 w-full min-w-0 rounded-xl border border-line bg-bg px-3 text-base text-ink outline-none focus:border-primary";
const label = "flex min-w-0 flex-col gap-1 text-sm font-medium text-ink";
const section = "flex flex-col gap-3 rounded-2xl border border-line bg-card p-4";
const heading = "font-display text-lg font-extrabold uppercase text-ink";


export function JobForm({ job, crew, defaultDate }: { job?: Job; crew: CrewOption[]; defaultDate: string }) {
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
              <input type="date" name="job_date" required defaultValue={job?.job_date ?? defaultDate} className={input} />
            </label>
            <label className={label}>
              Start time
              <input type="time" name="start_time" defaultValue={job?.start_time?.slice(0, 5) ?? "08:00"} className={input} />
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
                defaultValue={job?.est_hours ?? ""}
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
                </option>
              ))}
            </select>
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-ink">Movers on this job</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {crew
                .filter((c) => c.id !== lead)
                .map((c) => (
                  <label
                    key={c.id}
                    className={`press flex h-12 min-w-0 cursor-pointer items-center gap-2 rounded-xl border px-3 text-[15px] ${
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
                    <span className="truncate">{c.full_name}</span>
                  </label>
                ))}
            </div>
            <p className={`text-sm tabular-nums ${assigned < movers ? "text-warn" : "text-ok"}`}>
              {assigned < movers ? `⚠ ${assigned} of ${movers} assigned. ${movers - assigned} more needed.` : `✓ ${assigned} of ${movers} assigned`}
            </p>
          </fieldset>
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
