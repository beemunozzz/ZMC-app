import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { NotActive } from "@/components/NotActive";
import { PageLoading } from "@/components/PageLoading";
import { TIME_OFF_COLUMNS, timeOffText, type TimeOff } from "@/lib/availability";
import { ROLE_LABEL, requireMember } from "@/lib/crew";
import { fmtDay, todayISO } from "@/lib/dates";
import { cancelTimeOff } from "./actions";
import { TimeOffForm } from "./TimeOffForm";

export default function AvailabilityPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Availability />
    </Suspense>
  );
}

const STATUS: Record<TimeOff["status"], { label: string; cls: string }> = {
  approved: { label: "Approved", cls: "bg-ok/12 text-ok" },
  pending: { label: "Waiting on Zach", cls: "bg-warn/12 text-warn" },
  denied: { label: "Denied", cls: "bg-bad/10 text-bad" },
};

async function Availability() {
  const { supabase, me } = await requireMember();
  if (!me) return <NotActive />;
  const today = todayISO();
  const { data } = await supabase
    .from("time_off")
    .select(TIME_OFF_COLUMNS)
    .eq("crew_id", me.id)
    .gte("end_date", today)
    .order("start_date");
  const rows = (data ?? []) as TimeOff[];

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="My time off" isOwner={me.role === "owner"} name={me.full_name} roleLabel={ROLE_LABEL[me.role]} />
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-4">
        <p className="text-sm text-muted">Tell Zach ahead of time when you can&apos;t work, so he doesn&apos;t put you on those jobs.</p>
        <TimeOffForm today={today} />

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-extrabold uppercase text-ink">Coming up</h2>
          {rows.length ? (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold tabular-nums text-ink">
                      {fmtDay(r.start_date)}
                      {r.end_date !== r.start_date ? ` – ${fmtDay(r.end_date)}` : ""}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {timeOffText(r)}
                      {r.note ? ` · ${r.note}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                  <form action={cancelTimeOff}>
                    <input type="hidden" name="id" value={r.id} />
                    <button aria-label="Remove" className="press flex h-10 w-10 items-center justify-center rounded-xl text-lg text-muted">
                      ✕
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[15px] text-muted">Nothing marked. You&apos;re available every day.</p>
          )}
        </section>
      </main>
    </div>
  );
}
