import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { NotActive } from "@/components/NotActive";
import { PageLoading } from "@/components/PageLoading";
import { ROLE_LABEL, requireMember } from "@/lib/crew";
import { PROFILE_COLUMNS, type Profile } from "@/lib/setup";
import { InfoForm } from "./InfoForm";

export default function MyInfoPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <MyInfo />
    </Suspense>
  );
}

async function MyInfo() {
  const { supabase, me } = await requireMember();
  if (!me) return <NotActive />;
  const { data } = await supabase.from("crew_profile").select(PROFILE_COLUMNS).eq("crew_id", me.id).maybeSingle();

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="My info" isOwner={me.role === "owner"} name={me.full_name} roleLabel={ROLE_LABEL[me.role]} />
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-4">
        <InfoForm phone={me.phone ?? ""} profile={(data ?? null) as Profile | null} />
      </main>
    </div>
  );
}
