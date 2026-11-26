import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { PageLoading } from "@/components/PageLoading";
import { roleLabel, requireMember, type Role } from "@/lib/crew";
import { JOB_COLUMNS, type Job } from "@/lib/jobs";
import { JobForm } from "../../JobForm";
import { loadAvailability } from "@/lib/availability";
import { todayISO } from "@/lib/dates";

export default function EditJobPage({ params }: PageProps<"/jobs/[id]/edit">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <EditJob params={params} />
    </Suspense>
  );
}

async function EditJob({ params }: Pick<PageProps<"/jobs/[id]/edit">, "params">) {
  const { id } = await params;
  const { supabase, me } = await requireMember();
  if (!me || me.role !== "owner") redirect(`/jobs/${id}`);

  const [{ data: job }, { data: crew }] = await Promise.all([
    supabase.from("jobs").select(JOB_COLUMNS).eq("id", id).maybeSingle(),
    supabase.from("crew_members").select("id, full_name, role").eq("active", true).eq("is_dev", false).order("full_name"),
  ]);
  if (!job) notFound();
  const avail = await loadAvailability(supabase, (job as Job).job_date < todayISO() ? (job as Job).job_date : todayISO());

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="Edit job" isOwner name={me.full_name} roleLabel={roleLabel(me)} />
      <main className="mx-auto w-full max-w-3xl px-4 pt-4">
        <JobForm job={job as Job} crew={(crew ?? []) as { id: string; full_name: string; role: Role }[]} defaultDate={(job as Job).job_date} avail={avail} />
      </main>
    </div>
  );
}
