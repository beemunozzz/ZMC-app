import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { NotActive } from "@/components/NotActive";
import { PageLoading } from "@/components/PageLoading";
import { ROLE_LABEL, requireMember } from "@/lib/crew";
import { headers } from "next/headers";
import { ThemePicker } from "./ThemePicker";
import { CalendarLink } from "./CalendarLink";

export default function AccountPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Account />
    </Suspense>
  );
}

async function Account() {
  const { supabase, me } = await requireMember();
  if (!me) return <NotActive />;
  const [{ data: feed }, h] = await Promise.all([supabase.from("calendar_feeds").select("token").eq("crew_id", me.id).maybeSingle(), headers()]);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "zmc-app.vercel.app";
  const isOwner = me.role === "owner";
  const row = "press flex h-14 items-center justify-between px-4 text-[15px] font-medium text-ink transition-colors hover:bg-bg";
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="My settings" isOwner={isOwner} name={me.full_name} roleLabel={ROLE_LABEL[me.role]} />
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-4">
        <CalendarLink host={host} initial={(feed?.token as string) ?? null} />
        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
          <h2 className="font-display text-lg font-extrabold uppercase text-ink">Appearance</h2>
          <ThemePicker />
          <p className="text-xs text-muted">Saved on this phone. Each person picks their own.</p>
        </section>
        <nav className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
          <Link href="/notifications" className={row}>
            Notifications <span className="text-muted">›</span>
          </Link>
          {!isOwner && (
            <Link href="/availability" className={row}>
              My time off <span className="text-muted">›</span>
            </Link>
          )}
          <Link href="/account/password" className={row}>
            Change password <span className="text-muted">›</span>
          </Link>
        </nav>
      </main>
    </div>
  );
}
