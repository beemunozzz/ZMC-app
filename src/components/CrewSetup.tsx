import Link from "next/link";
import type { SetupItem } from "@/lib/setup";
import { Icon } from "./Icon";

/** "Get set up" checklist on the crew home screen. Each item ticks itself off once it's saved. Hidden when all done. */
export function SetupChecklist({ items }: { items: SetupItem[] }) {
  const done = items.filter((i) => i.done).length;
  if (done === items.length) return null;
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-extrabold uppercase text-ink">Get set up</h2>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-muted">
          {done} of {items.length} done
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-bg" aria-hidden>
        <div className="h-full rounded-full bg-primary" style={{ width: `${(done / items.length) * 100}%` }} />
      </div>
      <ul className="flex flex-col">
        {items.map((i) => (
          <li key={i.key}>
            <Link href={i.href} className="press -mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-bg">
              <span
                aria-hidden
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${i.done ? "border-ok bg-ok text-white" : "border-line"}`}
              >
                {i.done && <Icon name="check" className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[15px] font-semibold ${i.done ? "text-muted line-through" : "text-ink"}`}>{i.title}</span>
                {!i.done && <span className="block text-sm text-muted">{i.sub}</span>}
              </span>
              <span className="sr-only">{i.done ? "Done" : "Not done"}</span>
              {!i.done && <Icon name="chevron" className="h-4 w-4 shrink-0 text-muted" />}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const TILES = [
  { href: "/my-schedule", title: "My schedule", sub: "Days I can work" },
  { href: "/availability", title: "Time off", sub: "Days I need off" },
  { href: "/my-info", title: "My info", sub: "Contact, emergency" },
];

/** Shortcuts at the bottom of the crew home screen. */
export function CrewShortcuts() {
  return (
    <nav aria-label="Shortcuts" className="grid grid-cols-3 gap-2">
      {TILES.map((t) => (
        <Link key={t.href} href={t.href} className="press flex min-h-20 flex-col justify-between rounded-2xl border border-line bg-card p-3 transition-colors hover:border-primary/40">
          <span className="text-[15px] font-semibold leading-tight text-ink">{t.title}</span>
          <span className="text-xs leading-tight text-muted">{t.sub}</span>
        </Link>
      ))}
    </nav>
  );
}
