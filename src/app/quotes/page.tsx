import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { PageLoading } from "@/components/PageLoading";
import { ROLE_LABEL, requireMember } from "@/lib/crew";
import { fmtShort } from "@/lib/dates";
import { money } from "@/lib/pricing";
import { QUOTE_COLUMNS, QUOTE_STATUS, type Quote } from "@/lib/quotes";

export default function QuotesPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Quotes />
    </Suspense>
  );
}

async function Quotes() {
  const { supabase, me } = await requireMember();
  if (!me || me.role !== "owner") redirect("/");

  const { data, error } = await supabase.from("quotes").select(QUOTE_COLUMNS).order("created_at", { ascending: false }).limit(200);
  const quotes = (data ?? []) as Quote[];
  const waiting = quotes.filter((q) => q.status === "new").length;
  const open = quotes.filter((q) => q.status === "new" || q.status === "quoted");
  const closed = quotes.filter((q) => q.status === "booked" || q.status === "declined");

  const row = (q: Quote) => {
    const st = QUOTE_STATUS[q.status];
    return (
      <li key={q.id}>
        <Link href={`/quotes/${q.id}`} className="press flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-ink">{q.customer_name}</p>
            <p className="truncate text-sm text-muted">
              {q.move_date ? fmtShort(q.move_date) : "No date yet"} · {q.job_type}
              {q.heard_from ? ` · ${q.heard_from}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <span className="text-[15px] font-semibold tabular-nums text-ink">{q.quote_total != null ? money(Number(q.quote_total)) : "—"}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
          </div>
        </Link>
      </li>
    );
  };

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="Quotes" isOwner name={me.full_name} roleLabel={ROLE_LABEL[me.role]} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4">
        <Link href="/quotes/new" className="press flex h-12 items-center justify-center rounded-xl bg-primary font-semibold text-white dark:text-navy">
          + New quote request
        </Link>

        {error && (
          <p className="rounded-2xl bg-bad/10 px-4 py-3 text-sm text-bad">
            Couldn&apos;t load quotes. If this is the first time, the quotes table may not be set up yet in Supabase.
          </p>
        )}

        {!quotes.length && !error && (
          <p className="text-[15px] text-muted">
            No quote requests yet. When someone calls or texts for a price, tap &quot;New quote request&quot;. The app works out the
            price and writes the reply for you.
          </p>
        )}

        {open.length > 0 && (
          <section>
            <h2 className="mb-2 font-display text-lg font-extrabold uppercase text-ink">
              Open <span className="text-muted">· {waiting} waiting on a reply</span>
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">{open.map(row)}</ul>
          </section>
        )}

        {closed.length > 0 && (
          <section>
            <h2 className="mb-2 font-display text-lg font-extrabold uppercase text-muted">Booked and declined</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">{closed.map(row)}</ul>
          </section>
        )}
      </main>
    </div>
  );
}
