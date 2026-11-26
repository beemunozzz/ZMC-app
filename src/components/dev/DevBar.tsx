import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { VIEW_AS_COOKIE } from "@/lib/crew";
import { DevBarClient, type DevPerson } from "./DevBarClient";

/** The developer's "View as" bar at the top of every page. Shows nothing for everyone else. */
export async function DevBar() {
  try {
    return await devBar();
  } catch {
    return null; // the bar must never break a page
  }
}

async function devBar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase.from("crew_members").select("id, is_dev, active").eq("user_id", user.id).maybeSingle();
  if (!me?.is_dev || !me.active) return null;

  const { data } = await supabase.from("crew_members").select("id, full_name, role, employment").eq("active", true).order("full_name");
  const people = ((data ?? []) as DevPerson[]).filter((p) => p.id !== me.id);
  const viewAs = (await cookies()).get(VIEW_AS_COOKIE)?.value ?? "";
  const current = people.find((p) => p.id === viewAs) ?? null;
  return <DevBarClient people={people} current={current} />;
}
