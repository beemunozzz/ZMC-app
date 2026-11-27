import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { PageLoading } from "@/components/PageLoading";
import { roleLabel, requireMember } from "@/lib/crew";
import { fmtShort } from "@/lib/dates";
import { money } from "@/lib/pricing";
import { loadCustomers } from "./load";

export default function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; show?: string }> }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Customers searchParams={searchParams} />
    </Suspense>
  );
}

async function Customers({ searchParams }: { searchParams: Promise<{ q?: string; show?: string }> }) {
  const { supabase, me } = await requireMember();
  if (!me || me.role !== "owner") redirect("/");
  const sp = await searchParams;
  const { customers } = await loadCustomers(supabase);
  const term = (sp.q ?? "").trim().toLowerCase();
  const show = sp.show === "repeat" || sp.show === "jobs" ? sp.show : "all";
  const list = customers.filter(
    (c) =>
      (!term || c.name.toLowerCase().includes(term) || c.phone.replace(/\D/g, "").includes(term.replace(/\D/g, "") || "~")) &&
      (show === "all" || (show === "repeat" ? c.repeat : c.jobs.length > 0)),
  );
  const total = customers.reduce((s, c) => s + c.spent, 0);
  const repeat = customers.filter((c) => c.repeat).length;
  const tab = (k: string, label: string) => (
    <Link
      href={`/customers?show=${k}${term ? `&q=${encodeURIComponent(term)}` : ""}`}
      className={`press flex h-9 items-center rounded-full px-3 text-sm font-semibold ${show === k ? "bg-primary text-white dark:text-navy" : "border border-line text-ink"}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="Customers" isOwner name={me.full_name} roleLabel={roleLabel(me)} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4">
        <p className="text-sm text-muted">
          <b className="text-ink tabular-nums">{customers.length}</b> customers · <b className="text-ink tabular-nums">{repeat}</b> repeat ·{" "}
          <b className="text-ink tabular-nums">{money(total)}</b> paid in all
        </p>
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Search name or phone"
            className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-card px-3 text-base text-ink outline-none focus:border-primary"
          />
          <input type="hidden" name="show" value={show} />
          <button className="press h-11 rounded-xl bg-primary px-4 font-semibold text-white dark:text-navy">Search</button>
        </form>
        <div className="flex flex-wrap gap-2">
          {tab("all", "Everyone")}
          {tab("jobs", "Had a move with us")}
          {tab("repeat", "Repeat customers")}
        </div>

        {list.length ? (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {list.map((c) => (
              <li key={c.key}>
                <Link href={`/customers/${c.key}`} className="press flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-ink">
                      {c.name}
                      {c.repeat && <span className="ml-1.5 rounded-full bg-ok/12 px-1.5 py-px text-[10px] font-semibold uppercase text-ok">Repeat</span>}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {c.phone || "No phone"} · {c.jobs.length} job{c.jobs.length === 1 ? "" : "s"} · {c.quotes.length} quote{c.quotes.length === 1 ? "" : "s"}
                      {c.heardFrom ? ` · ${c.heardFrom}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[15px] font-semibold tabular-nums text-ink">{c.spent ? money(c.spent) : "—"}</p>
                    <p className="text-xs tabular-nums text-muted">{c.lastDate ? fmtShort(c.lastDate) : ""}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">No customers match.</p>
        )}
      </main>
    </div>
  );
}
