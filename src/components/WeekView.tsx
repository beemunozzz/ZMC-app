import { WEEKDAYS, WEEKDAY_LABEL, ruleText, type Week } from "@/lib/regular";

/** A regular weekly schedule as a simple 7-row list. Used by crew and by Zach. */
export function WeekView({ week, changedDays }: { week: Week; changedDays?: Set<string> }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
      {WEEKDAYS.map((d) => {
        const r = week[d];
        const changed = changedDays?.has(d);
        return (
          <li key={d} className={`flex items-center justify-between gap-3 px-4 py-2.5 text-[15px] ${changed ? "bg-warn/8" : ""}`}>
            <span className="w-24 shrink-0 font-medium text-ink">{WEEKDAY_LABEL[d]}</span>
            <span className={`text-right tabular-nums ${r.k === "off" ? "font-semibold text-bad" : r.k === "some" ? "font-semibold text-warn" : "text-muted"}`}>
              {ruleText(r)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
