import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { PageLoading } from "@/components/PageLoading";
import { ROLE_LABEL, requireMember, type Role } from "@/lib/crew";
import { isISODate, todayISO } from "@/lib/dates";
import { JobForm } from "../JobForm";

export default function NewJobPage({ searchParams }: PageProps<"/jobs/new">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <NewJob searchParams={searchParams} />
    </Suspense>
  );
}

async function NewJob({ searchParams }: Pick<PageProps<"/jobs/new">, "searchParams">) {
  const sp = await searchParams;
  const { supabase, me } = await requireMember();
  if (!me || me.role !== "owner") redirect("/");

  const { data } = await supabase.from("crew_members").select("id, full_name, role").eq("active", true).order("full_name");
  const date = typeof sp.date === "string" && isISODate(sp.date) ? sp.date : todayISO();

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="New job" isOwner name={me.full_name} roleLabel={ROLE_LABEL[me.role]} />
      <main className="mx-auto w-full max-w-3xl px-4 pt-4">
        <JobForm crew={(data ?? []) as { id: string; full_name: string; role: Role }[]} defaultDate={date} />
      </main>
    </div>
  );
}
