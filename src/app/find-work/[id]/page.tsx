import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { PageLoading } from "@/components/PageLoading";
import { availabilityFor, loadAvailability } from "@/lib/availability";
import { roleLabel, requireMember } from "@/lib/crew";
import { addDays, fmtDay, fmtHours, mondayOf, todayISO } from "@/lib/dates";
import { JOB_COLUMNS, cityOf, isLive, jobCrew, openSpots, timeSpan, type Job } from "@/lib/jobs";
import { weekHoursOf } from "@/lib/swap";
import { WorkList, type WorkItem } from "./WorkList";

export default function FindWorkPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <FindWork params={params} />
    </Suspense>
  );
}

/** Zach: jobs left this week that one crew member is free for, so he can add them or swap them in. */
async function FindWork({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, me } = await requireMember();
  if (me?.role !== "owner") redirect("/");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const today = todayISO();
  const week = mondayOf(today);
  const end = addDays(week, 6);
  const [{ data: person }, { data: jobRows }, { data: crewRows }, avail] = await Promise.all([
    supabase.from("crew_members").select("id, full_name, active, is_dev").eq("id", id).maybeSingle(),
    supabase.from("jobs").select(JOB_COLUMNS).gte("job_date", today).lte("job_date", end).order("job_date").order("start_time", { nullsFirst: false }),
    supabase.from("crew_members").select("id, full_name"),
    loadAvailability(supabase, week),
  ]);
  if (!person?.active || person.is_dev) notFound();
  const names = new Map((crewRows ?? []).map((c) => [c.id as string, c.full_name as string]));
  const first = (person.full_name as string).split(" ")[0];

  const items: WorkItem[] = ((jobRows ?? []) as Job[])
    .filter((j) => isLive(j) && !jobCrew(j).includes(id))
    .map((j) => ({ j, a: availabilityFor(id, j.job_date, j.start_time, Number(j.est_hours) || 2, avail.timeOff, avail.jobs, j.id, avail.regular) }))
    .filter(({ a }) => a.kind !== "off" && a.kind !== "busy")
    .map(({ j, a }) => ({
      id: j.id,
      day: j.job_date === today ? "Today" : fmtDay(j.job_date),
      time: timeSpan(j),
      hours: Number(j.est_hours) || 0,
      customer: j.customer_name,
      route: [cityOf(j.pickup_address), cityOf(j.dropoff_address)].filter(Boolean).join(" → "),
      open: openSpots(j),
      needed: j.movers_needed,
      note: a.kind === "free" ? "" : a.text,
      swappable: (j.crew_ids ?? []).map((c) => ({ id: c, name: names.get(c) ?? "Someone" })),
      hasLead: !!j.lead_id,
    }))
    .sort((a, b) => Number(b.open > 0) - Number(a.open > 0));
  const hours = weekHoursOf(id, avail.jobs, week);

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="Find work" isOwner name={me.full_name} roleLabel={roleLabel(me)} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4">
        <Link href="/" className="text-sm font-semibold text-primary">
          ‹ Home
        </Link>
        <div>
          <h1 className="font-display text-3xl font-extrabold uppercase leading-tight text-ink">More hours for {first}</h1>
          <p className="text-sm tabular-nums text-muted">
            {fmtHours(hours)} hrs scheduled this week. These are the jobs left this week that {first} is free for. Jobs that still need crew are first.
          </p>
        </div>
        <WorkList personId={id} first={first} items={items} />
        <Link href={`/schedule?view=week&date=${addDays(week, 7)}`} className="text-sm font-semibold text-primary">
          Look at next week ›
        </Link>
      </main>
    </div>
  );
}
