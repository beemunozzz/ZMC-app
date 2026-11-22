import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { PageLoading } from "@/components/PageLoading";
import { ROLE_LABEL, requireMember } from "@/lib/crew";
import { getPrices } from "@/lib/settings";
import { PricesForm } from "./PricesForm";

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const { supabase, me } = await requireMember();
  if (!me || me.role !== "owner") redirect("/");
  const prices = await getPrices(supabase);
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="Prices" isOwner name={me.full_name} roleLabel={ROLE_LABEL[me.role]} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-4">
        <h1 className="font-display text-2xl font-extrabold uppercase text-ink">Prices</h1>
        <p className="text-sm text-muted">
          Every quote uses these numbers. Change one, save, and new quotes use it right away. Quotes you already saved keep
          their price until you open and save them again.
        </p>
        <PricesForm prices={prices} />
      </main>
    </div>
  );
}
