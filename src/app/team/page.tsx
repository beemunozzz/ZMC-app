import { Suspense } from "react";
import { PageLoading } from "@/components/PageLoading";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ROLE_LABEL, requireMember, type CrewMember } from "@/lib/crew";
import { CrewRow } from "./CrewRow";
import { MemberForm } from "./MemberForm";

const ORDER = { owner: 0, lead: 1, mover: 2 } as const;

export default function TeamPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <TeamPageContent />
    </Suspense>
  );
}

async function TeamPageContent() {
  const { supabase, me } = await requireMember();
  if (!me || me.role !== "owner") redirect("/");

  const { data } = await supabase
    .from("crew_members")
    .select("id, user_id, email, full_name, phone, role, active")
    .returns<CrewMember[]>();

  const crew = (data ?? []).sort(
    (a, b) => Number(b.active) - Number(a.active) || ORDER[a.role] - ORDER[b.role] || a.full_name.localeCompare(b.full_name),
  );

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="Crew" isOwner name={me.full_name} roleLabel={ROLE_LABEL[me.role]} />

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
        <section>
          <h1 className="font-display text-2xl font-extrabold uppercase text-ink">Crew members</h1>
          <p className="mt-1 text-sm text-muted">
            Tap a person to change their details. Add someone&apos;s email so they can log in.
          </p>
          <ul className="mt-4 overflow-hidden rounded-2xl border border-line bg-card">
            {crew.map((m) => (
              <CrewRow key={m.id} member={m} isMe={m.id === me.id} />
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-line bg-card p-5">
          <h2 className="mb-4 font-display text-xl font-extrabold uppercase text-ink">Add someone</h2>
          <MemberForm />
        </section>
      </main>
    </div>
  );
}
