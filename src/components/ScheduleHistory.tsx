import { ZMC_TZ } from "@/lib/dates";
import { WEEKDAY_LABEL, cleanWeek, weekChanges, type Week, type WeeklySchedule } from "@/lib/regular";
import { WeekView } from "./WeekView";

const when = (ts: string) =>
  new Date(ts).toLocaleDateString("en-US", { timeZone: ZMC_TZ, month: "short", day: "numeric", year: "numeric" });

/** What each version changed, compared with the approved schedule before it. */
function withChanges(rows: WeeklySchedule[]) {
  let prev: Week | null = null;
  const out: { r: WeeklySchedule; w: Week; changes: ReturnType<typeof weekChanges> }[] = [];
  for (const r of [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const w = cleanWeek(r.days);
    out.push({ r, w, changes: prev ? weekChanges(prev, w) : [] });
    if (r.status === "approved") prev = w;
  }
  return out;
}

/**
 * Every version of someone's regular schedule, newest first. The first one is marked "Original",
 * so Zach can always see what the crew member first said.
 */
export function ScheduleHistory({ rows }: { rows: WeeklySchedule[] }) {
  if (!rows.length) return null;
  const items = withChanges(rows).reverse();

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg font-extrabold uppercase text-ink">History</h2>
      <ul className="flex flex-col gap-2">
        {items.map(({ r, w, changes }) => {
          const badge = r.is_original
            ? { text: "Original", cls: "bg-primary/10 text-primary" }
            : r.status === "approved"
              ? { text: "Approved", cls: "bg-ok/12 text-ok" }
              : r.status === "pending"
                ? { text: "Waiting on Zach", cls: "bg-warn/12 text-warn" }
                : { text: "Denied", cls: "bg-bad/10 text-bad" };
          return (
            <li key={r.id}>
              <details className="group rounded-2xl border border-line bg-card">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-ink">
                      {r.is_original ? "First filled in" : "Change asked"} · {when(r.created_at)}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {r.is_original
                        ? "Kept as the original"
                        : changes.map((c) => `${WEEKDAY_LABEL[c.day].slice(0, 3)}: ${c.after}`).join(" · ") || "No change"}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.cls}`}>{badge.text}</span>
                </summary>
                <div className="flex flex-col gap-2 px-4 pb-4">
                  {r.decided_at && !r.is_original && (
                    <p className="text-xs text-muted">
                      {r.status === "approved" ? "Approved" : "Denied"} {when(r.decided_at)}
                    </p>
                  )}
                  {r.note && <p className="text-sm text-muted">&ldquo;{r.note}&rdquo;</p>}
                  <WeekView week={w} changedDays={new Set(changes.map((c) => c.day))} />
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
