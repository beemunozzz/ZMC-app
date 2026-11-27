import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { InstallApp } from "@/components/InstallApp";
import { NotActive } from "@/components/NotActive";
import { PageLoading } from "@/components/PageLoading";
import { roleLabel, requireMember } from "@/lib/crew";
import { pushReady, vapidPublicKey } from "@/lib/push";
import { ALL_WEEK, WEEKLY_COLUMNS, cleanWeek, currentOf, type WeeklySchedule } from "@/lib/regular";
import { PROFILE_COLUMNS, type Profile } from "@/lib/setup";
import { InfoForm } from "../my-info/InfoForm";
import { WeekForm } from "../my-schedule/WeekForm";
import { WeekView } from "@/components/WeekView";
import { EnablePush } from "../notifications/EnablePush";
import { finishWelcome } from "./actions";

export default function WelcomePage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Welcome searchParams={searchParams} />
    </Suspense>
  );
}

const STEPS = ["Welcome", "About you", "Your schedule", "Home screen", "Notifications"];

/** First time a crew member signs in: a short walkthrough, like a new hire packet. */
async function Welcome({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const { supabase, me } = await requireMember();
  if (!me) return <NotActive />;
  const sp = await searchParams;
  const step = Math.min(Math.max(Number(sp.step) || 1, 1), STEPS.length + 1);
  const first = me.full_name.split(" ")[0];
  const nextHref = `/welcome?step=${step + 1}`;

  const [{ data: prof }, { data: weeks }] = await Promise.all([
    supabase.from("crew_profile").select(PROFILE_COLUMNS).eq("crew_id", me.id).maybeSingle(),
    supabase.from("weekly_schedules").select(WEEKLY_COLUMNS).eq("crew_id", me.id),
  ]);
  const current = currentOf((weeks ?? []) as WeeklySchedule[]);

  const skip = (
    <Link href={nextHref} className="self-center py-2 text-sm font-semibold text-muted">
      Skip for now
    </Link>
  );
  const big = "press flex h-14 items-center justify-center rounded-xl bg-primary text-lg font-semibold text-white dark:text-navy";

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="Welcome" isOwner={me.role === "owner"} name={me.full_name} roleLabel={roleLabel(me)} />
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-4">
        {step <= STEPS.length && (
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-1.5" aria-hidden>
              {STEPS.map((s, i) => (
                <span key={s} className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-primary" : "bg-line"}`} />
              ))}
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Step {step} of {STEPS.length} · {STEPS[step - 1]}
            </p>
          </div>
        )}

        {step === 1 && (
          <section className="hero flex flex-col gap-4 rounded-3xl px-5 py-6">
            <p className="font-logo text-4xl font-bold text-ink">ZMC.</p>
            <h1 className="font-display text-3xl font-extrabold uppercase leading-tight text-ink">Welcome to ZMC Hub, {first}!</h1>
            <p className="text-[15px] text-ink">
              This is where you&apos;ll see your jobs 2 to 3 weeks ahead, the moment Zach books them: times, addresses, who you&apos;re working with,
              and the weather.
            </p>
            <p className="text-[15px] text-muted">Let&apos;s get your account set up. It takes about 3 minutes:</p>
            <ol className="flex flex-col gap-1 text-[15px] text-ink">
              {STEPS.slice(1).map((s, i) => (
                <li key={s}>
                  <span className="tabular-nums text-tape">{i + 1}.</span> {s}
                </li>
              ))}
            </ol>
            <Link href={nextHref} className={big}>
              Let&apos;s go
            </Link>
          </section>
        )}

        {step === 2 && (
          <>
            <h1 className="font-display text-2xl font-extrabold uppercase text-ink">About you</h1>
            <p className="-mt-2 text-[15px] text-muted">Like a new hire packet: your contact info, emergency contact, license and sizes. No Social Security number.</p>
            <InfoForm phone={me.phone ?? ""} profile={(prof ?? null) as Profile | null} name={me.full_name} email={me.email ?? null} next={nextHref} />
            {skip}
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="font-display text-2xl font-extrabold uppercase text-ink">Your regular schedule</h1>
            {current ? (
              <>
                <p className="-mt-2 text-[15px] text-muted">You already set this up. You can ask to change it any time from Home → My schedule.</p>
                <WeekView week={cleanWeek(current.days)} />
                <Link href={nextHref} className={big}>
                  Continue
                </Link>
              </>
            ) : (
              <>
                <p className="-mt-2 text-[15px] text-muted">
                  You&apos;re expected to be ready any morning. Mark only the days you can&apos;t work, or the time you need to be off by (like
                  &ldquo;off by 6 PM on Tuesdays&rdquo;). Zach sees it when he puts people on jobs.
                </p>
                <WeekForm start={ALL_WEEK} isFirst next={nextHref} />
                {skip}
              </>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <h1 className="font-display text-2xl font-extrabold uppercase text-ink">Add ZMC Hub to your home screen</h1>
            <section className="rounded-2xl border border-line bg-card p-4">
              <InstallApp />
            </section>
            <p className="text-sm text-muted">Forgot how? It&apos;s always in ☰ → My settings → Add to home screen.</p>
            <Link href={nextHref} className={big}>
              Continue
            </Link>
          </>
        )}

        {step === 5 && (
          <>
            <h1 className="font-display text-2xl font-extrabold uppercase text-ink">Turn on notifications</h1>
            <p className="-mt-2 text-[15px] text-muted">
              Get told the moment you&apos;re put on a job, and the night before. On iPhone, open ZMC Hub from your home screen icon first, then
              turn this on.
            </p>
            <EnablePush publicKey={pushReady() ? vapidPublicKey() : ""} />
            <Link href={nextHref} className={big}>
              Continue
            </Link>
          </>
        )}

        {step > STEPS.length && (
          <section className="flex flex-col items-center gap-4 rounded-3xl border border-line bg-card px-5 py-8 text-center">
            <span className="pop flex h-16 w-16 items-center justify-center rounded-full bg-ok text-3xl text-white dark:text-navy" aria-hidden>
              ✓
            </span>
            <h1 className="font-display text-3xl font-extrabold uppercase text-ink">You&apos;re all set, {first}!</h1>
            <p className="text-[15px] text-muted">Your jobs show up on Home as soon as Zach puts you on one. Welcome to the crew.</p>
            <form action={finishWelcome} className="w-full">
              <button className={`${big} w-full`}>Go to my Home</button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
