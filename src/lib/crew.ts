import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

import type { CrewMember } from "@/lib/crew-types";

export { ROLE_LABEL, type CrewMember, type Role } from "@/lib/crew-types";

/** The signed-in person's crew record. Sends them to the login page if they aren't signed in. */
export async function requireMember() {
  await connection(); // always fresh: these pages depend on who's logged in and today's date
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("crew_members")
    .select("id, user_id, email, full_name, phone, role, active")
    .eq("user_id", user.id)
    .maybeSingle<CrewMember>();

  return { supabase, user, me: data && data.active ? data : null };
}
