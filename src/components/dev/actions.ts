"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VIEW_AS_COOKIE } from "@/lib/crew";

/** Developer only: preview the app as another crew member ("" = back to yourself). Lands on their Home. */
export async function setViewAs(crewId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("crew_members").select("id, is_dev").eq("user_id", user.id).maybeSingle();
  if (!me?.is_dev) return;
  const jar = await cookies();
  if (!crewId || crewId === me.id || !/^[0-9a-f-]{36}$/i.test(crewId)) jar.delete(VIEW_AS_COOKIE);
  else jar.set(VIEW_AS_COOKIE, crewId, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 7 * 86400 });
  redirect("/");
}
