import { Suspense } from "react";
import { PageLoading } from "@/components/PageLoading";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { NotActive } from "@/components/NotActive";
import { ROLE_LABEL, requireMember } from "@/lib/crew";

export default function Home() {
  return (
    <Suspense fallback={<PageLoading />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const { supabase, me } = await requireMember();
  if (!me) return <NotActive />;

  const isOwner = me.role === "owner";
  let crewCount = 0;
  let canLogIn = 0;
  if (isOwner) {
    const { data } = await supabase.from("crew_members").select("email, active").eq("active", true);
    crewCount = data?.length ?? 0;
    canLogIn = data?.filter((c) => c.email).length ?? 0;
  }

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title={isOwner ? "Schedule" : "My jobs"} isOwner={isOwner} name={me.full_name} roleLabel={ROLE_LABEL[me.role]} />

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
        <p className="text-sm text-muted">
          Hi <span className="font-semibold text-ink">{me.full_name}</span> · {ROLE_LABEL[me.role]}
        </p>

        <section className="rise rounded-2xl border border-line bg-card p-5">
          <div className="mb-3 h-1.5 w-10 rounded-full bg-tape" aria-hidden />
          <h1 className="font-display text-2xl font-extrabold uppercase text-ink">
            {isOwner ? "Schedule" : "Your jobs"}
          </h1>
          <p className="mt-1 text-[15px] text-muted">
            {isOwner
              ? "The week, month and today views come next. You'll book jobs and assign crew here."
              : "Your upcoming jobs will show here as soon as Zach books them."}
          </p>
        </section>

        {isOwner && (
          <Link href="/team" className="press rise flex items-center justify-between rounded-2xl border border-line bg-card p-5">
            <div>
              <h2 className="font-display text-xl font-extrabold uppercase text-ink">Crew members</h2>
              <p className="mt-0.5 text-sm text-muted tabular-nums">
                {crewCount} on the crew · {canLogIn} can log in
              </p>
            </div>
            <span className="text-2xl text-primary" aria-hidden>
              ›
            </span>
          </Link>
        )}
      </main>
    </div>
  );
}
