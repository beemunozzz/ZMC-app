import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { NotActive } from "@/components/NotActive";
import { PageLoading } from "@/components/PageLoading";
import { ToggleRow } from "@/components/Toggle";
import { ROLE_LABEL, requireMember } from "@/lib/crew";
import { pushReady, vapidPublicKey } from "@/lib/push";
import { setNightBefore } from "./actions";
import { EnablePush } from "./EnablePush";
import { KeyMaker } from "./KeyMaker";

export default function NotificationsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Notifications />
    </Suspense>
  );
}

async function Notifications() {
  const { supabase, me } = await requireMember();
  if (!me) return <NotActive />;
  const isOwner = me.role === "owner";
  const { data: prefs } = await supabase.from("crew_prefs").select("remind_night_before").eq("crew_id", me.id).maybeSingle();
  const timerReady = !!process.env.CRON_SECRET;

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="Notifications" isOwner={isOwner} name={me.full_name} roleLabel={ROLE_LABEL[me.role]} />
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-4">
        <EnablePush publicKey={pushReady() ? vapidPublicKey() : ""} />

        <section className="rounded-2xl border border-line bg-card p-4">
          <ToggleRow
            title="Night-before reminder"
            sub="Around 6 PM: tomorrow's start time and address"
            initial={prefs?.remind_night_before ?? true}
            save={setNightBefore}
          />
        </section>

        {isOwner && (!pushReady() || !timerReady) && <KeyMaker needPush={!pushReady()} needTimer={!timerReady} />}
      </main>
    </div>
  );
}
