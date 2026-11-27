import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { PageLoading } from "@/components/PageLoading";
import { roleLabel, requireMember } from "@/lib/crew";
import { money } from "@/lib/pricing";
import { smsHref } from "@/lib/texts";
import { PARTNER_KINDS } from "@/lib/partners";
import { addPartner, removePartner } from "./actions";

export default function PartnersPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Partners />
    </Suspense>
  );
}

type Partner = { id: string; name: string; kind: string; phone: string; email: string; notes: string };

/** Realtors, apartment managers and others who send customers our way, and what each one has brought in. */
async function Partners() {
  const { supabase, me } = await requireMember();
  if (!me || me.role !== "owner") redirect("/");
  const [{ data: p }, { data: q }, { data: inv }] = await Promise.all([
    supabase.from("partners").select("id, name, kind, phone, email, notes").order("name"),
    supabase.from("quotes").select("partner_id, status, job_id").not("partner_id", "is", null),
    supabase.from("invoices").select("job_id, total"),
  ]);
  const partners = (p ?? []) as Partner[];
  const quotes = (q ?? []) as { partner_id: string; status: string; job_id: string | null }[];
  const billed = new Map(((inv ?? []) as { job_id: string; total: number }[]).map((i) => [i.job_id, Number(i.total) || 0]));
  const stats = (id: string) => {
    const mine = quotes.filter((x) => x.partner_id === id);
    const booked = mine.filter((x) => x.status === "booked");
    return { leads: mine.length, booked: booked.length, revenue: booked.reduce((s, x) => s + (x.job_id ? (billed.get(x.job_id) ?? 0) : 0), 0) };
  };
  const ranked = partners.map((x) => ({ ...x, ...stats(x.id) })).sort((a, b) => b.revenue - a.revenue || b.leads - a.leads);
  const input = "h-11 min-w-0 rounded-xl border border-line bg-bg px-3 text-base text-ink outline-none focus:border-primary";

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="Partners" isOwner name={me.full_name} roleLabel={roleLabel(me)} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4">
        <p className="text-sm text-muted">
          Realtors, apartment managers and others who send customers your way. Pick the partner on a quote (&ldquo;Referral partner&rdquo;) and
          their leads, booked moves and revenue add up here.
        </p>

        <details className="rounded-2xl border border-line bg-card p-4" open={!partners.length}>
          <summary className="cursor-pointer font-display text-lg font-extrabold uppercase text-ink">+ Add a partner</summary>
          <form action={addPartner} className="mt-3 grid gap-2 sm:grid-cols-2">
            <input name="name" required placeholder="Name (e.g. Jane Smith, Keller Williams)" className={input} />
            <select name="kind" defaultValue="Realtor" className={input}>
              {PARTNER_KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
            <input name="phone" type="tel" inputMode="tel" placeholder="Phone" className={input} />
            <input name="email" type="email" inputMode="email" placeholder="Email" className={input} />
            <input name="notes" placeholder="Notes" className={`${input} sm:col-span-2`} />
            <button className="press h-11 rounded-xl bg-primary font-semibold text-white sm:col-span-2 dark:text-navy">Add partner</button>
          </form>
        </details>

        {ranked.length > 0 && (
          <ul className="flex flex-col gap-2">
            {ranked.map((x) => (
              <li key={x.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-ink">{x.name}</p>
                    <p className="text-xs text-muted">
                      {x.kind}
                      {x.phone ? ` · ${x.phone}` : ""}
                      {x.notes ? ` · ${x.notes}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-[15px] font-semibold tabular-nums text-ink">{money(x.revenue)}</p>
                </div>
                <p className="text-sm tabular-nums text-muted">
                  {x.leads} lead{x.leads === 1 ? "" : "s"} · {x.booked} booked
                </p>
                <div className="flex gap-2">
                  {x.phone && (
                    <a
                      href={smsHref(x.phone, `Hi ${x.name.split(" ")[0]}, Zach with Zachery's Moving Co. Thanks for thinking of us for your clients! `)}
                      className="press flex h-10 items-center rounded-xl border border-line px-3 text-sm font-semibold text-primary"
                    >
                      Text
                    </a>
                  )}
                  <form action={removePartner} className="ml-auto">
                    <input type="hidden" name="id" value={x.id} />
                    <button className="press h-10 px-2 text-sm font-semibold text-muted">Remove</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
