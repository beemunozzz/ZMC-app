"use server";

import { redirect } from "next/navigation";
import { requireMember } from "@/lib/crew";

/** The crew member finished (or skipped the rest of) the welcome walkthrough. */
export async function finishWelcome() {
  const { supabase, me } = await requireMember();
  if (!me) redirect("/");
  await supabase.from("crew_profile").upsert({ crew_id: me.id, onboarded_at: new Date().toISOString() }, { onConflict: "crew_id" });
  redirect("/");
}
