"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/crew";

/** Zach sent a follow-up text: count it, and move "Quoted" to "Follow up". */
export async function logFollowup(id: string): Promise<void> {
  const { supabase, me } = await requireMember();
  if (me?.role !== "owner" || !/^[0-9a-f-]{36}$/i.test(id)) return;
  const { data } = await supabase.from("quotes").select("followups, status").eq("id", id).maybeSingle();
  if (!data) return;
  await supabase
    .from("quotes")
    .update({ followups: (Number(data.followups) || 0) + 1, last_followup_at: new Date().toISOString(), ...(data.status === "quoted" ? { status: "follow_up" } : {}) })
    .eq("id", id);
  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
  revalidatePath("/");
}
