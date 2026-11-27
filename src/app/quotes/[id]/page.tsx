import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { PageLoading } from "@/components/PageLoading";
import { roleLabel, requireMember } from "@/lib/crew";
import { QUOTE_COLUMNS, QUOTE_STATUS, type Quote } from "@/lib/quotes";
import { followUpDue, followUpText } from "@/lib/followups";
import { siteUrl } from "@/lib/site-url";
import { todayISO } from "@/lib/dates";
import { FollowUpButton } from "../FollowUpButton";

const whenTs = (ts: string) =>
  new Date(ts).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
import { getAvgCrewRate, getOwnerCosts, getPrices } from "@/lib/settings";
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

  const [{ data }, prices, costs, crewRate, { data: partners }] = await Promise.all([
    supabase.from("quotes").select(QUOTE_COLUMNS).eq("id", id).maybeSingle(),
    getPrices(supabase),
    getOwnerCosts(supabase),
    getAvgCrewRate(supabase),
    supabase.from("partners").select("id, name, kind").order("name"),
  ]);
  if (!data) notFound();
  const quote = data as Quote;
  const st = QUOTE_STATUS[quote.status];
  const due = followUpDue(quote, todayISO());
  const followText = quote.share_token ? followUpText(quote, due?.kind ?? (quote.followups ? "second" : "first"), `${await siteUrl()}/q/${quote.share_token}`, prices.business_phone) : "";

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="Quote" isOwner name={me.full_name} roleLabel={roleLabel(me)} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 pt-4">
        <Link href="/quotes" className="text-sm font-semibold text-primary">
          ‹ All quotes
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="min-w-0 break-words font-display text-3xl font-extrabold uppercase leading-tight text-ink">{quote.customer_name}</h1>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
        </div>
        {sp.saved && <p className="rise rounded-xl bg-ok/12 px-4 py-3 text-sm font-medium text-ok">✓ Quote saved</p>}
        {quote.sent_at && !quote.accepted_at && (quote.status === "quoted" || quote.status === "follow_up") && quote.share_token && (
          <section className={`flex flex-col gap-2 rounded-2xl border p-4 ${due ? "border-warn/50 bg-warn/8" : "border-line bg-card"}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-extrabold uppercase text-ink">{due ? due.label : "Follow up"}</h2>
              <span className="text-xs tabular-nums text-muted">
                {quote.view_count > 0 ? `👀 Opened ${quote.view_count}× · last ${whenTs(quote.last_viewed_at!)}` : "Not opened yet"}
                {quote.followups > 0 ? ` · ${quote.followups} follow-up${quote.followups === 1 ? "" : "s"} sent` : ""}
              </span>
            </div>
            <p className="whitespace-pre-wrap break-words rounded-xl bg-bg p-3 text-sm text-ink">{followText}</p>
            <FollowUpButton id={quote.id} phone={quote.customer_phone} text={followText} />
          </section>
        )}
        <QuoteForm quote={quote} prices={prices} costs={costs} crewRate={crewRate} partners={partners ?? []} />
      </main>
    </div>
  );
}
