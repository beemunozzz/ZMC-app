import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { PageLoading } from "@/components/PageLoading";
import { roleLabel, requireMember } from "@/lib/crew";
import { addDays, fmtShort, nowMs, todayISO } from "@/lib/dates";
import { money } from "@/lib/pricing";
import { HEARD_FROM, LOST_REASONS, OPEN_STAGES, QUOTE_COLUMNS, QUOTE_STATUS, isLost, type Quote, type QuoteStatus } from "@/lib/quotes";
import { followUpDue } from "@/lib/followups";
import { LeadButtons } from "./LeadButtons";
import { createLead } from "./lead-actions";

export default function QuotesPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Quotes />
    </Suspense>
  );
}

const STAGE_HELP: Partial<Record<QuoteStatus, string>> = {
  new: "Reply fast: the first mover to answer usually wins the job.",
  contacted: "Talked to them. Get the details and send a price.",
  quoted: "Price sent. Waiting on them.",
  follow_up: "Needs a nudge.",
};

/** "12 min", "2 h", "3 days" since a time. */
function since(ts: string, now: number) {
  const m = Math.max(0, Math.round((now - Date.parse(ts)) / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} days`;
}

async function Quotes() {
  const { supabase, me } = await requireMember();
  if (!me || me.role !== "owner") redirect("/");

  const { data, error } = await supabase.from("quotes").select(QUOTE_COLUMNS).order("created_at", { ascending: false }).limit(400);
  const quotes = (data ?? []) as Quote[];
  const now = nowMs();
  const today = todayISO();
  const since90 = addDays(today, -90);
  const recent = quotes.filter((q) => q.created_at.slice(0, 10) >= since90);
  const booked90 = recent.filter((q) => q.status === "booked").length;
  const lost90 = recent.filter((q) => isLost(q.status));
  const decided = booked90 + lost90.length;
  const reasons = LOST_REASONS.map((r) => ({ r, n: lost90.filter((q) => (q.lost_reason || "Other") === r).length })).filter((x) => x.n);
  const closedSince = addDays(today, -30);
  const booked = quotes.filter((q) => q.status === "booked" && q.created_at.slice(0, 10) >= closedSince);
  const lost = quotes.filter((q) => isLost(q.status) && q.created_at.slice(0, 10) >= closedSince);

  const card = (q: Quote) => {
    const waitingMin = q.status === "new" && !q.contacted_at ? (now - Date.parse(q.created_at)) / 60000 : 0;
    const due = followUpDue(q, today);
    return (
      <li key={q.id} className="flex flex-col gap-2 rounded-xl border border-line bg-card p-3">
        <Link href={`/quotes/${q.id}`} className="press flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-ink">{q.customer_name}</p>
            <p className="truncate text-xs text-muted">
              {q.move_date ? fmtShort(q.move_date) : "No date yet"}
              {q.heard_from ? ` · ${q.heard_from}` : ""}
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{q.quote_total != null ? money(Number(q.quote_total)) : ""}</span>
        </Link>
        <div className="flex flex-wrap gap-1">
          {waitingMin > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                waitingMin >= 60 ? "bg-bad-fill text-white" : waitingMin >= 15 ? "bg-warn/15 text-warn" : "bg-bg text-muted"
              }`}
            >
              {waitingMin >= 15 ? "No reply yet · " : ""}
              {since(q.created_at, now)}
            </span>
          )}
          {q.view_count > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              👀 Opened {q.view_count}× · {since(q.last_viewed_at!, now)} ago
            </span>
          )}
          {due && <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-semibold text-warn">{due.label}</span>}
        </div>
        {q.status === "new" && <LeadButtons id={q.id} phone={q.customer_phone} name={q.customer_name} />}
      </li>
    );
  };

  const input = "h-11 min-w-0 rounded-xl border border-line bg-bg px-3 text-base text-ink outline-none focus:border-primary";

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="Leads" isOwner name={me.full_name} roleLabel={roleLabel(me)} />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4">
        {/* Quick lead: a call or text comes in, get it on the board in seconds. */}
        <details className="rounded-2xl border border-line bg-card p-4" open={!quotes.length}>
          <summary className="cursor-pointer font-display text-lg font-extrabold uppercase text-ink">+ New lead</summary>
          <form action={createLead} className="mt-3 grid gap-2 sm:grid-cols-2">
            <input name="customer_name" required placeholder="Name" autoComplete="off" className={input} />
            <input name="customer_phone" type="tel" inputMode="tel" placeholder="Phone" autoComplete="off" className={input} />
            <select name="heard_from" defaultValue="" className={input}>
              <option value="">How did they hear about us?</option>
              {HEARD_FROM.map((h) => (
                <option key={h}>{h}</option>
              ))}
            </select>
            <input name="notes" placeholder="Note (e.g. 3 bed, Dec 12, Lodi to Tracy)" autoComplete="off" className={input} />
            <div className="flex gap-2 sm:col-span-2">
              <button className="press h-11 flex-1 rounded-xl bg-primary font-semibold text-white dark:text-navy">Add to the board</button>
              <button name="open" value="1" className="press h-11 flex-1 rounded-xl border border-line font-semibold text-ink">
                Add and open the quote
              </button>
            </div>
          </form>
        </details>
        <Link href="/quotes/new" className="-mt-2 self-start text-sm font-semibold text-primary">
          Or start a full quote ›
        </Link>

        {error && <p className="rounded-2xl bg-bad/10 px-4 py-3 text-sm text-bad">Couldn&apos;t load the leads.</p>}

        {/* Win rate and why leads were lost (last 90 days) */}
        {decided > 0 && (
          <section className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-2xl border border-line bg-card px-4 py-3 text-sm">
            <span className="text-ink">
              <b className="tabular-nums">{Math.round((booked90 / decided) * 100)}%</b> booked{" "}
              <span className="text-muted">
                ({booked90} of {decided}, last 90 days)
              </span>
            </span>
            {reasons.length > 0 && (
              <span className="text-muted">
                Lost: {reasons.map((x) => `${x.r.toLowerCase()} ${x.n}`).join(" · ")}
              </span>
            )}
          </section>
        )}

        {/* The board: four open stages */}
        <div className="grid gap-4 md:grid-cols-4 md:gap-3">
          {OPEN_STAGES.map((s) => {
            const list = quotes.filter((q) => q.status === s);
            const value = list.reduce((n, q) => n + (Number(q.quote_total) || 0), 0);
            return (
              <section key={s} className="flex min-w-0 flex-col gap-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-display text-lg font-extrabold uppercase text-ink">
                    {QUOTE_STATUS[s].label} <span className="tabular-nums text-muted">{list.length}</span>
                  </h2>
                  {value > 0 && <span className="text-xs tabular-nums text-muted">{money(value)}</span>}
                </div>
                <p className="-mt-1 text-xs text-muted">{STAGE_HELP[s]}</p>
                {list.length ? (
                  <ul className="flex flex-col gap-2">{list.map(card)}</ul>
                ) : (
                  <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-sm text-muted">None</p>
                )}
              </section>
            );
          })}
        </div>

        {(booked.length > 0 || lost.length > 0) && (
          <div className="grid gap-4 md:grid-cols-2">
            <details className="rounded-2xl border border-line bg-card p-4">
              <summary className="cursor-pointer font-display text-lg font-extrabold uppercase text-ink">
                Booked <span className="text-muted">· last 30 days · {booked.length}</span>
              </summary>
              <ul className="mt-2 divide-y divide-line">
                {booked.map((q) => (
                  <li key={q.id}>
                    <Link href={`/quotes/${q.id}`} className="flex justify-between gap-2 py-2 text-sm">
                      <span className="truncate text-ink">{q.customer_name}</span>
                      <span className="shrink-0 tabular-nums text-muted">{q.quote_total != null ? money(Number(q.quote_total)) : ""}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
            <details className="rounded-2xl border border-line bg-card p-4">
              <summary className="cursor-pointer font-display text-lg font-extrabold uppercase text-ink">
                Lost <span className="text-muted">· last 30 days · {lost.length}</span>
              </summary>
              <ul className="mt-2 divide-y divide-line">
                {lost.map((q) => (
                  <li key={q.id}>
                    <Link href={`/quotes/${q.id}`} className="flex justify-between gap-2 py-2 text-sm">
                      <span className="truncate text-ink">{q.customer_name}</span>
                      <span className="shrink-0 text-muted">{q.lost_reason || "No reason"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}
      </main>
    </div>
  );
}
