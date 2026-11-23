import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { NotActive } from "@/components/NotActive";
import { PageLoading } from "@/components/PageLoading";
import { ROLE_LABEL, requireMember } from "@/lib/crew";
import { pushReady, vapidPublicKey } from "@/lib/push";
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
  const { data: phones } = await supabase.from("push_subscriptions").select("id, device, created_at").eq("crew_id", me.id);

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="Notifications" isOwner={isOwner} name={me.full_name} roleLabel={ROLE_LABEL[me.role]} />
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-4">
        <EnablePush publicKey={pushReady() ? vapidPublicKey() : ""} />

        <section className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
          <h2 className="font-display text-lg font-extrabold uppercase text-ink">You&apos;ll be told when</h2>
          <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink">
            {isOwner ? (
              <>
                <li>Someone can&apos;t make a job</li>
                <li>Someone asks for time off with less than 7 days&apos; notice</li>
              </>
            ) : (
              <>
                <li>You&apos;re put on a job</li>
                <li>Your job changes (day or time) or you&apos;re taken off it</li>
                <li>Zach approves or denies your time off</li>
              </>
            )}
          </ul>
          {(phones ?? []).length > 0 && (
            <p className="text-xs text-muted">
              On for: {(phones ?? []).map((p) => p.device || "a device").join(", ")}
            </p>
          )}
        </section>

        {isOwner && !pushReady() && <KeyMaker />}
      </main>
    </div>
  );
}
