import Link from "next/link";
import { fmtDayLong } from "@/lib/dates";
import { jobCrew, telUrl, timeSpan, type Job } from "@/lib/jobs";
import { AddressBlock } from "./AddressBlock";
import { WeatherNote } from "./WeatherNote";
import { OnMyWay } from "./TextButtons";
import type { JobWx } from "@/lib/weather-kinds";

export function NextJob({
  job,
  names,
  meId,
  today,
  wx,
  senderName,
}: {
  job: Job;
  names: Map<string, string>;
  meId: string;
  today: string;
  wx?: JobWx | null;
  /** Set when the viewer leads this job: shows the "On my way" text button. */
  senderName?: string;
}) {
  const others = jobCrew(job)
    .filter((id) => id !== meId)
    .map((id) => (names.get(id) ?? "Removed") + (id === job.lead_id ? " (lead)" : ""));

  return (
    <section className="rise flex flex-col gap-3 rounded-2xl border border-line bg-card p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-tape">
          {job.job_date === today ? "Your job today" : `Your next job · ${fmtDayLong(job.job_date)}`}
        </p>
        <p className="mt-1 font-display text-3xl font-extrabold uppercase tabular-nums leading-none text-ink">{timeSpan(job)}</p>
        <p className="mt-2 break-words text-base font-semibold text-ink">
          {job.customer_name} <span className="font-normal text-muted">· {job.job_type}</span>
        </p>
      </div>

      <WeatherNote wx={wx} />

      {senderName && job.lead_id === meId && (
        <OnMyWay phone={job.customer_phone} customerName={job.customer_name} senderName={senderName} primary />
      )}

      <AddressBlock label="Pickup" address={job.pickup_address} house={job.pickup_house} primary />
      <AddressBlock label="Drop-off" address={job.dropoff_address} house={job.dropoff_house} />

      <dl className="grid gap-2 text-sm">
        {job.customer_phone && (
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-muted">Customer</dt>
            <dd>
              <a href={telUrl(job.customer_phone)} className="font-semibold text-primary">
                {job.customer_phone}
              </a>
            </dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-muted">Working with</dt>
          <dd className="break-words text-ink">{others.length ? others.join(", ") : "No one else assigned yet"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-muted">Truck</dt>
          <dd className="text-ink">{job.truck === "theirs" ? "Customer has their own" : "We bring ours"}</dd>
        </div>
        {job.heavy_items && (
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-muted">Heavy items</dt>
            <dd className="break-words text-ink">{job.heavy_items}</dd>
          </div>
        )}
      </dl>
      {job.notes && <p className="whitespace-pre-wrap break-words rounded-xl bg-bg p-3 text-sm text-ink">{job.notes}</p>}

      {senderName && job.lead_id === meId && (
        <Link
          href={`/jobs/${job.id}/invoice`}
          className="press flex h-14 items-center justify-center rounded-xl border-2 border-primary text-lg font-semibold text-primary"
        >
          Finish job &amp; invoice
        </Link>
      )}

      <Link href={`/jobs/${job.id}`} className="text-sm font-semibold text-primary">
        See all job details ›
      </Link>
    </section>
  );
}
