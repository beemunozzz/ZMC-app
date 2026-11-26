import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

import type { CrewMember } from "@/lib/crew-types";

export { EMPLOYMENT, ROLE_LABEL, isLimited, roleLabel, type CrewMember, type Employment, type Role } from "@/lib/crew-types";

const MEMBER_COLUMNS = "id, user_id, email, full_name, phone, role, active, employment, is_dev";
/** Cookie the developer's "View as" bar sets: the crew id being previewed. */
export const VIEW_AS_COOKIE = "zmc-view-as";
export const PREVIEW_MESSAGE = "Preview mode: switch back to yourself (top bar) to make changes.";

/**
 * Read-only stand-in for the database while the developer previews someone else's view:
 * reading works as normal; anything that saves (insert, update, upsert, delete, rpc) does nothing
 * and returns an error, so nothing is ever done "as" another person by accident.
 */
function readOnly(supabase: SupabaseClient): SupabaseClient {
  const blocked = () => {
    const result = { data: null, error: { message: PREVIEW_MESSAGE }, count: null, status: 403, statusText: "Preview" };
    const chain: unknown = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === "then") return (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(result).then(ok, bad);
        return () => chain;
      },
      apply() {
        return chain;
      },
    });
    return chain;
  };
  const WRITES = new Set(["insert", "update", "upsert", "delete"]);
  return new Proxy(supabase, {
    get(target, prop, receiver) {
      if (prop === "rpc") return blocked;
      if (prop === "from") {
        return (table: string) => {
          const q = target.from(table);
          return new Proxy(q, { get: (t, p, r) => (WRITES.has(String(p)) ? blocked : Reflect.get(t, p, r)) });
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

/**
 * The signed-in person's crew record. Sends them to the login page if they aren't signed in.
 * For the developer, "me" can be someone else they're previewing (read-only), and `realMe` is them.
 */
export async function requireMember() {
  await connection(); // always fresh: these pages depend on who's logged in and today's date
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase.from("crew_members").select(MEMBER_COLUMNS).eq("user_id", user.id).maybeSingle<CrewMember>();
  const realMe = data && data.active ? data : null;

  if (realMe?.is_dev) {
    const viewAs = (await cookies()).get(VIEW_AS_COOKIE)?.value ?? "";
    if (/^[0-9a-f-]{36}$/i.test(viewAs) && viewAs !== realMe.id) {
      const { data: other } = await supabase.from("crew_members").select(MEMBER_COLUMNS).eq("id", viewAs).eq("active", true).maybeSingle<CrewMember>();
      if (other) return { supabase: readOnly(supabase), user, me: other as CrewMember | null, realMe, previewing: true };
    }
  }
  return { supabase, user, me: realMe, realMe, previewing: false };
}
