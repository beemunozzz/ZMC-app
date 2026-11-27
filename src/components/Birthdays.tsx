// Birthdays coming up (month and day only, never the year or age). Server component.
import type { SupabaseClient } from "@supabase/supabase-js";

type B = { crew_id: string; full_name: string; month_day: string; days_away: number };

export async function Birthdays({ supabase, days = 7, meId }: { supabase: SupabaseClient; days?: number; meId?: string }) {
  const { data } = await supabase.rpc("upcoming_birthdays", { p_days: days });
  const list = (data ?? []) as B[];
  if (!list.length) return null;
  const when = (b: B) => {
    if (b.days_away === 0) return "today! 🎉";
    if (b.days_away === 1) return "tomorrow";
    const [m, d] = b.month_day.split("-").map(Number);
    return new Date(Date.UTC(2000, m - 1, d)).toLocaleDateString("en-US", { timeZone: "UTC", weekday: undefined, month: "short", day: "numeric" });
  };
  return (
    <section className="flex items-start gap-3 rounded-2xl border border-tape/40 bg-tape/10 px-4 py-3">
      <span className="text-2xl leading-none" aria-hidden>
        🎂
      </span>
      <ul className="flex flex-col gap-0.5 text-[15px] text-ink">
        {list.map((b) => (
          <li key={b.crew_id}>
            {b.crew_id === meId ? (
              <b>Happy birthday{b.days_away === 0 ? "" : " soon"}, {b.full_name.split(" ")[0]}!</b>
            ) : (
              <>
                <b>{b.full_name.split(" ")[0]}</b>&apos;s birthday is {when(b)}
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
