import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { PageLoading } from "@/components/PageLoading";
import { ROLE_LABEL, requireMember } from "@/lib/crew";
import { QUOTE_COLUMNS, QUOTE_STATUS, type Quote } from "@/lib/quotes";
import { getPrices } from "@/lib/settings";
import { QuoteForm } from "../QuoteForm";

export default function QuotePage({ params, searchParams }: PageProps<"/quotes/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <QuoteView params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function QuoteView({ params, searchParams }: Pick<PageProps<"/quotes/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, me } = await requireMember();
  if (!me || me.role !== "owner") redirect("/");

  const [{ data }, prices] = await Promise.all([
    supabase.from("quotes").select(QUOTE_COLUMNS).eq("id", id).maybeSingle(),
    getPrices(supabase),
  ]);
  if (!data) notFound();
  const quote = data as Quote;
  const st = QUOTE_STATUS[quote.status];

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="Quote" isOwner name={me.full_name} roleLabel={ROLE_LABEL[me.role]} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 pt-4">
        <Link href="/quotes" className="text-sm font-semibold text-primary">
          ‹ All quotes
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="min-w-0 break-words font-display text-3xl font-extrabold uppercase leading-tight text-ink">{quote.customer_name}</h1>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
        </div>
        {sp.saved && <p className="rise rounded-xl bg-ok/12 px-4 py-3 text-sm font-medium text-ok">✓ Quote saved</p>}
        <QuoteForm quote={quote} prices={prices} />
      </main>
    </div>
  );
}
