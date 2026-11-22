import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { PageLoading } from "@/components/PageLoading";
import { ROLE_LABEL, requireMember } from "@/lib/crew";
import { getPrices } from "@/lib/settings";
import { QuoteForm } from "../QuoteForm";

export default function NewQuotePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <NewQuote />
    </Suspense>
  );
}

async function NewQuote() {
  const { supabase, me } = await requireMember();
  if (!me || me.role !== "owner") redirect("/");
  const prices = await getPrices(supabase);
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="New quote" isOwner name={me.full_name} roleLabel={ROLE_LABEL[me.role]} />
      <main className="mx-auto w-full max-w-3xl px-4 pt-4">
        <QuoteForm prices={prices} />
      </main>
    </div>
  );
}
