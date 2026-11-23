import Link from "next/link";
import { fmtDay, fmtDayLong } from "@/lib/dates";
import { jobCrew, telUrl, timeSpan, type Job } from "@/lib/jobs";
import type { JobWx } from "@/lib/weather-kinds";
import { Avatars } from "./Avatars";
import { CantMakeIt } from "./CantMakeIt";
import { Icon } from "./Icon";
import { RouteLine } from "./RouteLine";
import { OnMyWay } from "./TextButtons";
import { WeatherNote } from "./WeatherNote";
import { MeetUp, type MeetInfo } from "./MeetUp";

/**
 * The crew's job "ticket": a navy band with the time big, the route drawn as a line with
 * Navigate at each stop, and who they're working with. Details and actions follow below.
 */
export function NextJob({
  job,
  names,
  meId,
  today,
  wx,
  senderName,
  cover,
  meet,
}: {
  job: Job;
  names: Map<string, string>;
  meId: string;
  today: string;
  wx?: JobWx | null;
  /** Set when the viewer leads this job: shows the "On my way" text button. */
  senderName?: string;
  /** "Can't make this job?" (own screen only). */
  cover?: { zachPhone: string; open: { id: string; reason: string } | null };
  /** Where and when the crew meets. */
  meet?: MeetInfo;
}) {
  const crew = jobCrew(job).map((id) => ({ id, name: names.get(id) ?? "Removed" }));
  const others = crew.filter((c) => c.id !== meId);
  const leading = senderName && job.lead_id === meId;
  const [start, end] = timeSpan(job).split(" – ");

  return (
    <section className="flex flex-col overflow-hidden rounded-3xl border border-line bg-card">
      {/* The ticket */}
      <div className="hero flex flex-col gap-4 px-5 pb-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xl font-extrabold uppercase leading-tight text-muted">
            {job.job_date === today ? "Your job today" : `Next job · ${fmtDayLong(job.job_date)}`}
          </h2>
          {leading && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-tape/20 px-2.5 py-0.5 text-xs font-semibold text-tape">
              <Icon name="star" filled className="h-3.5 w-3.5" /> You lead
            </span>
          )}
        </div>
        <div>
          <p className="font-display text-6xl font-extrabold tabular-nums leading-none text-tape">{start}</p>
          {end && <p className="mt-1 text-sm tabular-nums text-muted">until {end}</p>}
          <p className="mt-3 break-words text-lg font-semibold leading-snug text-ink">{job.customer_name}</p>
          <p className="text-sm text-muted">{job.job_type}</p>
        </div>

        <RouteLine pickup={job.pickup_address} pickupHouse={job.pickup_house} dropoff={job.dropoff_address} dropoffHouse={job.dropoff_house} />

        <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatars people={crew} leadId={job.lead_id} />
            <span className="min-w-0 truncate text-sm text-muted">
              {others.length ? `With ${others.map((o) => o.name.split(" ")[0]).join(", ")}` : "No one else yet"}
            </span>
          </div>
          {job.customer_phone && (
            <a href={telUrl(job.customer_phone)} className="press flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-semibold text-ink" aria-label="Call the customer">
              <Icon name="phone" className="h-4 w-4" /> Call
            </a>
          )}
        </div>
      </div>

      {/* Below the ticket: what to bring and what to do */}
      <div className="flex flex-col gap-3 p-5">
        {meet && <MeetUp {...meet} />}
        <WeatherNote wx={wx} />

        {leading && <OnMyWay phone={job.customer_phone} customerName={job.customer_name} senderName={senderName} primary />}

        <dl className="grid gap-2 text-sm">
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

        {leading && (
          <Link
            href={`/jobs/${job.id}/invoice`}
            className="press flex h-14 items-center justify-center rounded-xl border-2 border-primary text-lg font-semibold text-primary"
          >
            Finish job &amp; invoice
          </Link>
        )}

        <Link href={`/jobs/${job.id}`} className="text-sm font-semibold text-primary">
          All job details
        </Link>
        {cover && (
          <CantMakeIt jobId={job.id} jobLabel={`${fmtDay(job.job_date)} · ${job.customer_name}`} zachPhone={cover.zachPhone} open={cover.open} />
        )}
      </div>
    </section>
  );
}
