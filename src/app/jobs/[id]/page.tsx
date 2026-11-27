import Link from "next/link";
import { Icon } from "@/components/Icon";
import { TruckReserved } from "@/components/TruckReserved";
import { CrewSwap } from "@/components/CrewSwap";
import { swapCandidates } from "@/lib/swap";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { RouteLine } from "@/components/RouteLine";
import { Avatars } from "@/components/Avatars";
import { AppHeader } from "@/components/AppHeader";
import { NotActive } from "@/components/NotActive";
import { PageLoading } from "@/components/PageLoading";
import { roleLabel, requireMember } from "@/lib/crew";
import { fmtDayLong, fmtHours, todayISO } from "@/lib/dates";
import { OutlookNote, WeatherNote } from "@/components/WeatherNote";
import { MeetUp } from "@/components/MeetUp";
import { loadMeet } from "@/lib/meet";
import { loadChecklist } from "@/lib/checklist-server";
import { LoadChecklist } from "@/components/LoadChecklist";
import { money } from "@/lib/pricing";
import { jobForecast, jobOutlook, jobTemps, stocktonForecast, stocktonOutlook } from "@/lib/weather";
import { WX_EMOJI, WX_LABEL } from "@/lib/weather-kinds";
import { getPrices } from "@/lib/settings";
import { bookingText, reminderText } from "@/lib/texts";
import { OnMyWay, TextLink } from "@/components/TextButtons";
import { ReminderLink } from "@/components/ReminderLink";
import { CantMakeIt } from "@/components/CantMakeIt";
import { COVER_COLUMNS, type CoverRequest } from "@/lib/availability";
import { fmtDay } from "@/lib/dates";
import { JOB_COLUMNS, STATUS, conflicts, isLive, jobCrew, needsTruck, openSpots, telUrl, timeSpan, type Job } from "@/lib/jobs";

export default function JobPage({ params, searchParams }: PageProps<"/jobs/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <JobDetails params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function JobDetails({ params, searchParams }: Pick<PageProps<"/jobs/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, me } = await requireMember();
  if (!me) return <NotActive />;
  const isOwner = me.role === "owner";

  const { data } = await supabase.from("jobs").select(JOB_COLUMNS).eq("id", id).maybeSingle();
  if (!data) notFound();
  const job = data as Job;

  const [{ data: crewRows }, { data: sameDay }] = await Promise.all([
    supabase.from("crew_members").select("id, full_name, phone"),
    supabase.from("jobs").select(JOB_COLUMNS).eq("job_date", job.job_date),
  ]);
  const crewById = new Map((crewRows ?? []).map((c) => [c.id as string, c as { id: string; full_name: string; phone: string | null }]));
  const people = jobCrew(job);
  const st = STATUS[job.status];
  const hrs = Number(job.est_hours) || 0;
  const short = openSpots(job);
  const clashes = conflicts(job, (sameDay ?? []) as Job[]);
  // Zach: who could swap in (free that day, fewest hours first).
  const candidates = isOwner && isLive(job) ? await swapCandidates(supabase, job) : null;
  const wx = job.status === "canceled" ? null : await jobForecast(job, await stocktonForecast());
  // Low and high during working hours (7 AM to 8 PM) at the pickup, for the header.
  const temps = wx && isLive(job) ? await jobTemps(job) : null;
  // Days 8-14: NOAA's rough outlook until the real forecast is available.
  const later = !wx && isLive(job) && job.job_date >= todayISO() ? await jobOutlook(job, await stocktonOutlook()) : null;

  // Texting: the owner can send all three; the job's crew lead can send "On my way".
  const isLead = job.lead_id === me.id;
  const canText = (isOwner || isLead) && job.status !== "canceled" && job.status !== "done";
  const prices = canText ? await getPrices(supabase) : null;
  const { data: sentRow } = isOwner
    ? await supabase.from("jobs").select("reminder_sent_at").eq("id", job.id).maybeSingle()
    : { data: null };
  const reminderSent = !!(sentRow as { reminder_sent_at?: string | null } | null)?.reminder_sent_at;

  // Crew on this job can say "Can't make this job?". The owner sees everyone's requests.
  const onJob = !isOwner && people.includes(me.id) && job.status !== "canceled" && job.status !== "done";
  const { data: coverRows } = await supabase.from("cover_requests").select(COVER_COLUMNS).eq("job_id", job.id).eq("status", "open");
  const covers = (coverRows ?? []) as CoverRequest[];
  const myCover = covers.find((c) => c.crew_id === me.id) ?? null;
  const zachPhone = onJob ? (await getPrices(supabase)).business_phone : "";

  // Where and when the crew meets (live jobs only).
  const names = new Map([...crewById.values()].map((c) => [c.id, c.full_name]));
  const meet = isLive(job) ? (await loadMeet(supabase, [job], me, names)).get(job.id) : undefined;
  const checklist = isLive(job) ? await loadChecklist(supabase, job, wx, names, me.id) : null;

  // Invoice: the owner or this job's crew lead can finish the job and invoice it.
  const canInvoice = (isOwner || isLead) && job.status !== "canceled";
  const { data: invRow } = canInvoice
    ? await supabase.from("invoices").select("id, total, paid_at, hours, movers, verified_hours, verified_movers, hours_verified_at, owner_edited_at").eq("job_id", job.id).maybeSingle()
    : { data: null };
  const invoice = invRow as {
    id: string;
    total: number;
    paid_at: string | null;
    hours: number;
    movers: number;
    verified_hours: number | null;
    verified_movers: number | null;
    hours_verified_at: string | null;
    owner_edited_at: string | null;
  } | null;

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex gap-3 py-2">
      <dt className="w-24 shrink-0 text-sm text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-[15px] text-ink">{value}</dd>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="Job" isOwner={isOwner} name={me.full_name} roleLabel={roleLabel(me)} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4">
        <Link href={`/schedule?view=week&date=${job.job_date}`} className="flex items-center gap-1 self-start text-sm font-semibold text-primary">
          <Icon name="back" className="h-4 w-4" /> Back to the schedule
        </Link>

        {sp.saved && <p className="rise rounded-xl bg-ok/12 px-4 py-3 text-sm font-medium text-ok">✓ Saved to the schedule</p>}
        {sp.booked && (
          <div className="rise flex flex-col gap-2 rounded-xl bg-ok/12 px-4 py-3">
            <p className="text-sm font-medium text-ok">✓ Booked from the quote. Next: text the customer, then tap Edit job to pick the crew.</p>
            {prices && <TextLink phone={job.customer_phone} body={bookingText(job, prices)} label="Text booking confirmation" primary />}
          </div>
        )}

        {/* Navy header band: who, when, and the route */}
        <section className="hero -mx-4 flex flex-col gap-4 px-4 pb-5 pt-5 sm:mx-0 sm:rounded-3xl sm:px-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-start justify-between gap-3">
              <h1 className="min-w-0 break-words font-display text-3xl font-extrabold uppercase leading-[0.95] text-ink">{job.customer_name}</h1>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
            </div>
            <p className="text-[15px] tabular-nums text-muted">
              {fmtDayLong(job.job_date)}
              {wx && (
                <span className="text-ink">
                  {" · "}
                  <span aria-hidden>{WX_EMOJI[wx.kind]}</span> {wx.text || WX_LABEL[wx.kind]}
                </span>
              )}
              {temps && (
                <span className="whitespace-nowrap text-ink" title="Low and high between 7 AM and 8 PM">
                  {" · "}L {temps.lo}° H {temps.hi}°
                </span>
              )}
            </p>
            <p className="font-display text-4xl font-extrabold tabular-nums leading-none text-tape">{timeSpan(job)}</p>
            <p className="text-sm tabular-nums text-muted">
              {hrs ? `About ${fmtHours(hrs)} hrs` : "Hours not set"}
              {hrs && people.length ? ` · ${fmtHours(hrs * people.length)} crew-hrs` : ""}
              {" · "}
              {job.job_type}
            </p>
          </div>
          <RouteLine pickup={job.pickup_address} pickupHouse={job.pickup_house} dropoff={job.dropoff_address} dropoffHouse={job.dropoff_house} />
          {/* Bottom row: crew on the left, who brings the truck on the right */}
          <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
            {people.length > 0 ? (
              <div className="flex min-w-0 items-center gap-3">
                <Avatars people={people.map((pid) => ({ id: pid, name: crewById.get(pid)?.full_name ?? "Removed" }))} leadId={job.lead_id} />
                <span className="text-sm tabular-nums text-muted">
                  {people.length} of {job.movers_needed} crew
                </span>
              </div>
            ) : (
              <span className="text-sm font-semibold text-bad">No crew yet</span>
            )}
            {job.truck === "theirs" ? (
              <span className="shrink-0 rounded-full bg-bg px-3 py-1 text-sm font-semibold text-muted">Customer&apos;s truck</span>
            ) : (
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
                  needsTruck(job) ? "bg-warn/15 text-warn" : "bg-primary/10 text-primary"
                }`}
              >
                <Icon name="truck" className="h-4 w-4" /> {needsTruck(job) ? "Our truck · not reserved" : job.truck_reserved_at ? "Our truck · reserved ✓" : "We bring our truck"}
              </span>
            )}
          </div>
        </section>

        {job.truck !== "theirs" && isLive(job) && (isOwner || isLead || !job.truck_reserved_at) && (
          <TruckReserved jobId={job.id} reservedAt={job.truck_reserved_at ?? null} canEdit={isOwner || isLead} />
        )}

        {!people.length && job.status !== "canceled" && (
          <p className="rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">
            <b>No crew assigned yet.</b> {isOwner ? "Tap Edit job to pick a lead and movers." : "Zach will assign a crew soon."}
          </p>
        )}
        {clashes.length > 0 && (
          <p className="rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">
            <b>Double-booked:</b>{" "}
            {clashes.map((c) => `${crewById.get(c.crewId)?.full_name ?? "Someone"} is also on ${c.other.customer_name}`).join("; ")}.
          </p>
        )}

        {meet && <MeetUp {...meet} />}
        {checklist && <LoadChecklist jobId={job.id} items={checklist} canTick={isOwner || people.includes(me.id)} />}
        <WeatherNote wx={wx} />
        <OutlookNote o={later} />

        {isOwner &&
          covers.map((c) => (
            <p key={c.id} className="rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">
              <b>{crewById.get(c.crew_id)?.full_name ?? "Someone"} can&apos;t make this job.</b>
              {c.reason ? ` “${c.reason}”` : ""} Tap Edit job to pick someone else.
            </p>
          ))}


        <dl className="divide-y divide-line rounded-2xl border border-line bg-card px-4">
          {row("Job", job.job_type)}
          {row("Truck", job.truck === "theirs" ? "Customer has their own" : "We bring ours")}
          {row(
            "Customer",
            job.customer_phone ? (
              <a href={telUrl(job.customer_phone)} className="font-semibold text-primary">
                {job.customer_phone}
              </a>
            ) : (
              <span className="text-muted">No phone on file</span>
            ),
          )}
          {job.heavy_items && row("Heavy items", job.heavy_items)}
          {isOwner &&
            row(
              "Not to exceed",
              job.nte != null ? (
                <span className="font-semibold tabular-nums">{money(Number(job.nte))}</span>
              ) : (
                <span className="text-warn">Not set. Add one with Edit job.</span>
              ),
            )}
          {isOwner && job.quote_id && row("Quote", <Link href={`/quotes/${job.quote_id}`} className="font-semibold text-primary">View the quote</Link>)}
        </dl>

        {isOwner && isLive(job) && candidates ? (
          <CrewSwap
            jobId={job.id}
            members={people.map((pid) => ({ id: pid, name: crewById.get(pid)?.full_name ?? "Removed", phone: crewById.get(pid)?.phone ?? null, isLead: pid === job.lead_id }))}
            candidates={candidates}
            short={short}
            needed={job.movers_needed}
          />
        ) : (
          <section className="rounded-2xl border border-line bg-card p-4">
            <h2 className="font-display text-lg font-extrabold uppercase text-ink">
              Crew <span className="tabular-nums text-muted">({people.length} of {job.movers_needed})</span>
            </h2>
            {people.length ? (
              <ul className="mt-2 flex flex-col gap-2">
                {people.map((pid) => {
                  const c = crewById.get(pid);
                  return (
                    <li key={pid} className="flex items-center justify-between gap-3 text-[15px]">
                      <span className="min-w-0 break-words text-ink">
                        {pid === job.lead_id ? (
                          <b className="inline-flex items-center gap-1">
                            <Icon name="star" filled className="h-4 w-4 text-tape" /> {c?.full_name ?? "Removed"}
                          </b>
                        ) : (
                          (c?.full_name ?? "Removed")
                        )}
                        {pid === job.lead_id && <span className="text-muted"> · crew lead</span>}
                      </span>
                      {c?.phone && (
                        <a href={telUrl(c.phone)} className="shrink-0 text-sm font-semibold text-primary">
                          {c.phone}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-muted">Nobody assigned yet.</p>
            )}
            {short > 0 && people.length > 0 && <p className="mt-2"><span className="rounded-full bg-bad-fill px-2.5 py-0.5 text-xs font-semibold text-white">Need {short} more</span></p>}
          </section>
        )}

        {canText && prices && (
          <section className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
            <h2 className="font-display text-lg font-extrabold uppercase text-ink">Text the customer</h2>
            <p className="text-sm text-muted">Opens Messages with the text written for you. Check it, then tap Send.</p>
            <OnMyWay phone={job.customer_phone} customerName={job.customer_name} senderName={me.full_name} primary={isLead} />
            {isOwner && (
              <div className="grid grid-cols-2 gap-2">
                <TextLink phone={job.customer_phone} body={bookingText(job, prices)} label="Booking confirmation" />
                <ReminderLink jobId={job.id} phone={job.customer_phone} body={reminderText(job, prices)} sent={reminderSent} />
              </div>
            )}
          </section>
        )}

        {onJob && <CantMakeIt jobId={job.id} jobLabel={`${fmtDay(job.job_date)} · ${job.customer_name}`} zachPhone={zachPhone} open={myCover ? { id: myCover.id, reason: myCover.reason } : null} />}

        {job.notes && (
          <section className="rounded-2xl border border-line bg-card p-4">
            <h2 className="font-display text-lg font-extrabold uppercase text-ink">Notes for the crew</h2>
            <p className="mt-1 whitespace-pre-wrap break-words text-[15px] text-ink">{job.notes}</p>
          </section>
        )}

        {(isOwner || canInvoice) && (
          <div className="flex flex-col gap-2 pb-4">
            {invoice && (
              <p className="rounded-xl bg-ok/12 px-3 py-2.5 text-sm text-ok">
                <b>✓ Hours verified by the customer:</b>{" "}
                <span className="tabular-nums">
                  {Number(invoice.verified_hours ?? invoice.hours)} hrs · {invoice.verified_movers ?? invoice.movers} movers
                </span>
                {invoice.owner_edited_at && (
                  <span className="block text-warn">
                    Changed by Zach to {Number(invoice.hours)} hrs · {invoice.movers} movers.
                  </span>
                )}
                <span className="block text-xs text-muted">Locked. Only Zach can change the hours.</span>
              </p>
            )}
            {canInvoice &&
              (invoice ? (
                <Link
                  href={`/invoices/${invoice.id}`}
                  className={`press flex h-14 items-center justify-center gap-2 rounded-xl text-lg font-semibold ${
                    invoice.paid_at ? "border border-ok/40 text-ok" : "bg-warn text-white dark:text-navy"
                  }`}
                >
                  {invoice.paid_at ? `✓ Paid ${money(Number(invoice.total))} · View invoice` : `Get paid · ${money(Number(invoice.total))}`}
                </Link>
              ) : (
                <Link
                  href={`/jobs/${job.id}/invoice`}
                  className="press flex h-14 items-center justify-center rounded-xl bg-primary text-lg font-semibold text-white dark:text-navy"
                >
                  Finish job &amp; invoice
                </Link>
              ))}
            {isOwner && (
              <Link
                href={`/jobs/${job.id}/edit`}
                className="press flex h-12 items-center justify-center rounded-xl border border-line font-semibold text-ink"
              >
                Edit job
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
