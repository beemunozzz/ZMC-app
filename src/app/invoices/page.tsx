import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { PageLoading } from "@/components/PageLoading";
import { ROLE_LABEL, requireMember } from "@/lib/crew";
import { PAY_LABEL, type PayMethod } from "@/lib/invoices";
import { money } from "@/lib/pricing";

export default function InvoicesPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Invoices />
    </Suspense>
  );
}

type Row = { id: string; customer_name: string; total: number; payment_method: PayMethod; paid_at: string | null; created_at: string };

async function Invoices() {
  const { supabase, me } = await requireMember();
  if (!me || me.role !== "owner") redirect("/");
  const { data, error } = await supabase
    .from("invoices")
    .select("id, customer_name, total, payment_method, paid_at, created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  const rows = (data ?? []) as Row[];
  const waiting = rows.filter((r) => !r.paid_at);
  const paid = rows.filter((r) => r.paid_at);
  const sum = (list: Row[]) => list.reduce((s, r) => s + Number(r.total), 0);
  const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric" });

  const list = (items: Row[]) => (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
      {items.map((r) => (
        <li key={r.id}>
          <Link href={`/invoices/${r.id}`} className="press flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-ink">{r.customer_name}</p>
              <p className="truncate text-sm text-muted">
                {day(r.created_at)} · {PAY_LABEL[r.payment_method]}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <span className="text-[15px] font-semibold tabular-nums text-ink">{money(Number(r.total))}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.paid_at ? "bg-ok/12 text-ok" : "bg-warn/12 text-warn"}`}>
                {r.paid_at ? "Paid" : "Waiting"}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="Invoices" isOwner name={me.full_name} roleLabel={ROLE_LABEL[me.role]} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-line bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Waiting</p>
            <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-warn">{money(sum(waiting))}</p>
            <p className="text-xs text-muted">{waiting.length} invoice{waiting.length === 1 ? "" : "s"}</p>
          </div>
          <div className="rounded-2xl border border-line bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Paid</p>
            <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-ok">{money(sum(paid))}</p>
            <p className="text-xs text-muted">{paid.length} invoice{paid.length === 1 ? "" : "s"}</p>
          </div>
        </div>
        {error && <p className="rounded-2xl bg-bad/10 px-4 py-3 text-sm text-bad">Couldn&apos;t load invoices. The invoices setup may not have been run in Supabase yet.</p>}
        {!rows.length && !error && <p className="text-[15px] text-muted">No invoices yet. Open a job and tap &ldquo;Finish job &amp; invoice&rdquo;.</p>}
        {waiting.length > 0 && (
          <section>
            <h2 className="mb-2 font-display text-lg font-extrabold uppercase text-ink">Waiting for payment</h2>
            {list(waiting)}
          </section>
        )}
        {paid.length > 0 && (
          <section>
            <h2 className="mb-2 font-display text-lg font-extrabold uppercase text-muted">Paid</h2>
            {list(paid)}
          </section>
        )}
      </main>
    </div>
  );
}
