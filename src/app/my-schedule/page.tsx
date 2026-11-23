import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { NotActive } from "@/components/NotActive";
import { PageLoading } from "@/components/PageLoading";
import { WeekView } from "@/components/WeekView";
import { ROLE_LABEL, requireMember } from "@/lib/crew";
import { ALL_WEEK, WEEKDAY_LABEL, WEEKLY_COLUMNS, cleanWeek, currentOf, weekChanges, type WeeklySchedule } from "@/lib/regular";
import { cancelWeekRequest } from "./actions";
import { ChangeWeek, WeekForm } from "./WeekForm";
import { ScheduleHistory } from "@/components/ScheduleHistory";

export default function MySchedulePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <MySchedule />
    </Suspense>
  );
}

async function MySchedule() {
  const { supabase, me } = await requireMember();
  if (!me) return <NotActive />;
  const { data } = await supabase.from("weekly_schedules").select(WEEKLY_COLUMNS).eq("crew_id", me.id).order("created_at");
  const rows = (data ?? []) as WeeklySchedule[];
  const current = currentOf(rows);
  const week = current ? cleanWeek(current.days) : null;
  const pending = rows.find((r) => r.status === "pending") ?? null;
  const pendingWeek = pending ? cleanWeek(pending.days) : null;
  const changes = pendingWeek && week ? weekChanges(week, pendingWeek) : [];

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="My schedule" isOwner={me.role === "owner"} name={me.full_name} roleLabel={ROLE_LABEL[me.role]} />
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-4">
        {!week ? (
          <>
            <p className="text-[15px] text-muted">
              You&apos;re expected to be ready any morning. Just mark the days you can&apos;t work, or the time you need to be off by (like
              &ldquo;off by 6 PM on Tuesdays&rdquo; for kids pickup). Zach sees it when he puts people on jobs.
            </p>
            <WeekForm start={ALL_WEEK} isFirst />
          </>
        ) : (
          <>
            <section className="flex flex-col gap-2">
              <h2 className="font-display text-lg font-extrabold uppercase text-ink">My regular schedule</h2>
              <WeekView week={week} />
            </section>

            {pending && pendingWeek ? (
              <section className="flex flex-col gap-3 rounded-2xl border border-warn/40 bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-lg font-extrabold uppercase text-ink">Change requested</h2>
                  <span className="shrink-0 rounded-full bg-warn/12 px-2.5 py-0.5 text-xs font-semibold text-warn">Waiting on Zach</span>
                </div>
                <ul className="flex flex-col gap-1 text-sm">
                  {changes.map((c) => (
                    <li key={c.day} className="text-ink">
                      <b>{WEEKDAY_LABEL[c.day]}:</b> <span className="text-muted line-through">{c.before}</span> → {c.after}
                    </li>
                  ))}
                </ul>
                {pending.note && <p className="text-sm text-muted">&ldquo;{pending.note}&rdquo;</p>}
                <form action={cancelWeekRequest}>
                  <input type="hidden" name="id" value={pending.id} />
                  <button className="press h-11 w-full rounded-xl border border-line text-sm font-semibold text-ink">Take back this request</button>
                </form>
              </section>
            ) : (
              <ChangeWeek start={week} />
            )}

            <ScheduleHistory rows={rows} />
          </>
        )}
      </main>
    </div>
  );
}
