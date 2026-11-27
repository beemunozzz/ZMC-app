import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { PageLoading } from "@/components/PageLoading";
import { roleLabel, requireMember } from "@/lib/crew";
import { cityOf } from "@/lib/jobs";
import { fmtShort } from "@/lib/dates";
import { money } from "@/lib/pricing";
import { QUOTE_STATUS, type QuoteStatus } from "@/lib/quotes";
import { smsHref } from "@/lib/texts";
import { saveCustomerNote } from "../actions";
import { loadCustomers } from "../load";

export default function CustomerPage({ params }: { params: Promise<{ key: string }> }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <CustomerView params={params} />
    </Suspense>
  );
}

const tel = (p: string) => `tel:${p.replace(/[^0-9+]/g, "")}`;

async function CustomerView({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const { supabase, me } = await requireMember();
  if (!me || me.role !== "owner") redirect("/");
  const [{ customers, partners }, { data: noteRow }] = await Promise.all([
    loadCustomers(supabase),
    supabase.from("customer_notes").select("note").eq("phone_key", key).maybeSingle(),
  ]);
  const c = customers.find((x) => x.key === key);
  if (!c) notFound();
  const partner = c.partnerId ? partners.get(c.partnerId) : null;

  // One timeline, newest first.
  type Item = { date: string; kind: string; title: string; sub: string; href: string; amount?: number; tag?: { label: string; cls: string } };
  const items: Item[] = [
    ...c.quotes.map((q) => ({
      date: q.created_at.slice(0, 10),
      kind: "Quote",
      title: `${q.move_date ? `Move ${fmtShort(q.move_date)}` : "Quote"}: ${[cityOf(q.pickup_address), cityOf(q.dropoff_address)].filter(Boolean).join(" → ") || "no addresses yet"}`,
      sub: q.lost_reason ? `Lost: ${q.lost_reason}` : "",
      href: `/quotes/${q.id}`,
      amount: q.quote_total ?? undefined,
      tag: QUOTE_STATUS[q.status as QuoteStatus],
    })),
    ...c.jobs.map((j) => ({
      date: j.job_date,
      kind: "Job",
      title: `${j.job_type}: ${[cityOf(j.pickup_address), cityOf(j.dropoff_address)].filter(Boolean).join(" → ")}`,
      sub: j.status === "canceled" ? "Canceled" : j.status === "done" ? "Done" : "Upcoming",
      href: `/jobs/${j.id}`,
    })),
    ...c.invoices.map((i) => ({
      date: i.created_at.slice(0, 10),
      kind: "Invoice",
      title: i.paid_at ? "Paid" : "Waiting for payment",
      sub: i.rating ? `Rated ${"★".repeat(i.rating)}${"☆".repeat(5 - i.rating)}` : "",
      href: `/invoices/${i.id}`,
      amount: Number(i.total),
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const first = c.name.replace(/^example:\s*/i, "").split(/\s+/)[0] || "there";
  const stat = (label: string, value: string) => (
    <div className="rounded-xl bg-bg px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="Customer" isOwner name={me.full_name} roleLabel={roleLabel(me)} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4">
        <Link href="/customers" className="text-sm font-semibold text-primary">
          ‹ All customers
        </Link>
        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <h1 className="min-w-0 break-words font-display text-3xl font-extrabold uppercase leading-tight text-ink">{c.name}</h1>
            {c.repeat && <span className="shrink-0 rounded-full bg-ok/12 px-2.5 py-0.5 text-xs font-semibold text-ok">Repeat customer</span>}
          </div>
          <p className="text-sm text-muted">
            {c.phone || "No phone"}
            {c.email ? ` · ${c.email}` : ""}
            {c.heardFrom ? ` · Found us: ${c.heardFrom}` : ""}
            {c.referredBy ? ` · Referred by ${c.referredBy}` : ""}
            {partner ? ` · Partner: ${partner.name} (${partner.kind})` : ""}
          </p>
          {c.phone && (
            <div className="grid grid-cols-2 gap-2">
              <a href={tel(c.phone)} className="press flex h-11 items-center justify-center rounded-xl border border-line font-semibold text-primary">
                Call
              </a>
              <a href={smsHref(c.phone, `Hi ${first}, this is Zach with Zachery's Moving Co. `)} className="press flex h-11 items-center justify-center rounded-xl border border-line font-semibold text-primary">
                Text
              </a>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {stat("Paid", money(c.spent))}
            {stat("Moves", String(c.jobs.filter((j) => j.status !== "canceled").length))}
            {stat("Quotes", String(c.quotes.length))}
            {stat("Rating", c.rating ? `${c.rating} ★` : "—")}
          </div>
        </section>

        <section className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
          <h2 className="font-display text-lg font-extrabold uppercase text-ink">Notes</h2>
          <form action={saveCustomerNote} className="flex flex-col gap-2">
            <input type="hidden" name="key" value={c.key} />
            <textarea
              name="note"
              defaultValue={(noteRow?.note as string) ?? ""}
              rows={3}
              placeholder="Gate code, parking, pets, what they liked, anything to remember next time"
              className="rounded-xl border border-line bg-bg p-3 text-base text-ink outline-none focus:border-primary"
            />
            <button className="press h-11 self-start rounded-xl bg-primary px-4 font-semibold text-white dark:text-navy">Save note</button>
          </form>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-extrabold uppercase text-ink">History</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {items.map((it) => (
              <li key={`${it.kind}-${it.href}`}>
                <Link href={it.href} className="press flex items-center gap-3 px-4 py-3">
                  <span className="w-16 shrink-0 text-xs tabular-nums text-muted">{fmtShort(it.date)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">
                      <span className="font-semibold">{it.kind}</span> · {it.title}
                    </p>
                    {it.sub && <p className="truncate text-xs text-muted">{it.sub}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    {it.amount != null && <span className="text-sm font-semibold tabular-nums text-ink">{money(it.amount)}</span>}
                    {it.tag && <span className={`rounded-full px-2 py-px text-[10px] font-semibold ${it.tag.cls}`}>{it.tag.label}</span>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
