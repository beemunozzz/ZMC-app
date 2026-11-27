import Link from "next/link";
import { Icon } from "@/components/Icon";
import { fmtHours } from "@/lib/dates";
import { STATUS, cityOf, jobCrew, openSpots, timeSpan, type Job } from "@/lib/jobs";
import { WX_EMOJI, WX_LABEL, WX_WATCH, type JobWx } from "@/lib/weather-kinds";

export function JobCard({
  job,
  names,
  doubleBooked,
  isOwner,
  wx,
}: {
  job: Job;
  names: Map<string, string>;
  doubleBooked: boolean;
  isOwner: boolean;
  wx?: JobWx | null;
}) {
  const wxWatch = wx && WX_WATCH.includes(wx.kind) && job.status !== "canceled" ? wx : null;
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
      className={`press block rounded-2xl border bg-card p-4 transition-colors md:p-3 hover:border-primary/40 ${
        !crew.length && !canceled ? "border-bad/50" : "border-line"
      } ${canceled ? "opacity-60" : ""}`}
    >
      {/* Row 1: the time, on one line */}
      <p className="truncate whitespace-nowrap text-[15px] font-semibold tabular-nums text-ink md:text-[13px]">{timeSpan(job)}</p>
      {/* Row 2: status and who brings the truck, always in the same spots */}
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
        {job.truck === "theirs" ? (
          <span className="rounded-full bg-bg px-2 py-0.5 text-[11px] font-semibold text-muted">Their truck</span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            <Icon name="truck" className="h-3 w-3" /> Our truck
          </span>
        )}
      </div>
      <p className="mt-1 text-xs tabular-nums text-muted">
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
            <Icon name="star" filled className="mr-1 inline h-3.5 w-3.5 -translate-y-px text-tape" />
            <span className="text-muted">Lead:</span>{" "}
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
            <Icon name="alert" className="mr-1 inline h-4 w-4 -translate-y-px" />
            No crew assigned{isOwner ? " · tap to assign" : ""}
          </p>
        )
      )}

      {/* Row 4: flags */}
      {(short > 0 && crew.length > 0) || doubleBooked || wxWatch ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {short > 0 && crew.length > 0 && !canceled && (
            <span className="rounded-full bg-warn/12 px-2.5 py-0.5 text-xs font-semibold text-warn">Need {short} more</span>
          )}
          {doubleBooked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-bad/10 px-2.5 py-0.5 text-xs font-semibold text-bad">
              <Icon name="alert" className="h-3.5 w-3.5" /> Double-booked
            </span>
          )}
          {wxWatch && (
            <span className="rounded-full bg-warn/12 px-2.5 py-0.5 text-xs font-semibold text-warn">
              {WX_EMOJI[wxWatch.kind]} {WX_LABEL[wxWatch.kind]}
            </span>
          )}
        </div>
      ) : null}
    </Link>
  );
}
