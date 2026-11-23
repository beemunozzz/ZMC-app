"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/crew";

/** Make (or, with reset, replace) this person's private calendar link. Returns the code. */
export async function calendarLink(reset: boolean): Promise<{ token?: string; error?: string }> {
  const { supabase, me } = await requireMember();
  if (!me) return { error: "Your account isn't active." };
  if (reset) await supabase.from("calendar_feeds").delete().eq("crew_id", me.id);
  const { data: have } = await supabase.from("calendar_feeds").select("token").eq("crew_id", me.id).maybeSingle();
  if (have) return { token: have.token as string };
  const { data, error } = await supabase.from("calendar_feeds").insert({ crew_id: me.id }).select("token").single();
  revalidatePath("/account");
  return error ? { error: `Couldn't make the link: ${error.message}` } : { token: data.token as string };
}
