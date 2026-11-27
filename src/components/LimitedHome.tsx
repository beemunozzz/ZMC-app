import { AppHeader } from "@/components/AppHeader";
import { roleLabel, type CrewMember } from "@/lib/crew-types";
import { telUrl } from "@/lib/jobs";
import type { SetupItem } from "@/lib/setup";
import { CrewShortcuts, SetupChecklist, WelcomeCard } from "./CrewSetup";

/** Home screen for crew on call (between jobs) or on a leave of absence: no schedule, no jobs. */
export function LimitedHome({ me, kind, phone, setup }: { me: CrewMember; kind: "on_call" | "leave"; phone: string; setup: SetupItem[] }) {
  const first = me.full_name.split(" ")[0];
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="Home" isOwner={false} name={me.full_name} roleLabel={roleLabel(me)} />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
        <section className="rounded-2xl border border-line bg-card p-5">
          <h1 className="font-display text-3xl font-extrabold uppercase leading-tight text-ink">Hi {first}</h1>
          {kind === "on_call" ? (
            <>
              <p className="mt-2 text-[15px] text-ink">
                <b>No work scheduled for you right now.</b>
              </p>
              <p className="mt-1 text-[15px] text-muted">
                You&apos;re on call. When Zach puts you on a job, it shows up here the day before, with the address, time and crew.
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-[15px] text-ink">
                <b>You&apos;re on a leave of absence.</b>
              </p>
              <p className="mt-1 text-[15px] text-muted">Your schedule is hidden for now. Zach will turn it back on when you&apos;re back.</p>
            </>
          )}
        </section>
        <WelcomeCard name={me.full_name} items={setup} />
        <SetupChecklist items={setup} />
        <a href={telUrl(phone)} className="press flex h-14 items-center justify-center rounded-xl bg-primary text-lg font-semibold text-white dark:text-navy">
          Call Zach · {phone}
        </a>
        <CrewShortcuts />
      </main>
    </div>
  );
}
