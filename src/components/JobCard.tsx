import Link from "next/link";
import { fmtHours } from "@/lib/dates";
import { STATUS, cityOf, jobCrew, openSpots, timeSpan, type Job } from "@/lib/jobs";

export function JobCard({
  job,
  names,
  doubleBooked,
  isOwner,
}: {
  job: Job;
  names: Map<string, string>;
  doubleBooked: boolean;
  isOwner: boolean;
}) {
  const st = STATUS[job.status];
  const crew = jobCrew(job);
  const hrs = Number(job.est_hours) || 0;
  const short = openSpots(job);
  const name = (id: string) => names.get(id) ?? "Removed";
  const route = [cityOf(job.pickup_address), cityOf(job.dropoff_address)].filter(Boolean).join(" → ");
  const canceled = job.status === "canceled";

  return (
    <Link
      href={`/jobs/${job.id}`}
      className={`press block rounded-2xl border bg-card p-4 ${
        !crew.length && !canceled ? "border-bad/50" : "border-line"
      } ${canceled ? "opacity-60" : ""}`}
    >
      {/* Row 1: time + status, always in the same spot */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-[15px] font-semibold tabular-nums text-ink">{timeSpan(job)}</span>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
      </div>
      <p className="mt-0.5 text-xs tabular-nums text-muted">
        {hrs ? `${fmtHours(hrs)} hrs · ` : ""}
        {crew.length} of {job.movers_needed} crew
        {hrs && crew.length ? ` · ${fmtHours(hrs * crew.length)} crew-hrs` : ""}
      </p>

      {/* Row 2: who and where */}
      <p className={`mt-2 break-words text-base font-semibold text-ink ${canceled ? "line-through" : ""}`}>{job.customer_name}</p>
      {route && <p className="break-words text-sm text-muted">{route}</p>}

      {/* Row 3: crew */}
      {crew.length ? (
        <div className="mt-2 space-y-0.5 text-sm text-ink">
          <p className="break-words">
            <span className="text-muted">★ Lead:</span>{" "}
            {job.lead_id ? <b>{name(job.lead_id)}</b> : <span className="text-warn">not picked</span>}
          </p>
          {job.crew_ids.length > 0 && (
            <p className="break-words">
              <span className="text-muted">Movers:</span> {job.crew_ids.map(name).join(", ")}
            </p>
          )}
        </div>
      ) : (
        !canceled && (
          <p className="mt-2 text-sm font-semibold text-bad">
            ⚠ No crew assigned{isOwner ? " · tap to assign" : ""}
          </p>
        )
      )}

      {/* Row 4: flags */}
      {(short > 0 && crew.length > 0) || doubleBooked || job.truck === "theirs" ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {short > 0 && crew.length > 0 && !canceled && (
            <span className="rounded-full bg-warn/12 px-2.5 py-0.5 text-xs font-semibold text-warn">Need {short} more</span>
          )}
          {doubleBooked && (
            <span className="rounded-full bg-bad/10 px-2.5 py-0.5 text-xs font-semibold text-bad">⚠ Double-booked</span>
          )}
          {job.truck === "theirs" && (
            <span className="rounded-full bg-bg px-2.5 py-0.5 text-xs font-medium text-muted">Their truck</span>
          )}
        </div>
      ) : null}
    </Link>
  );
}
