"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/crew";
import { SHIRT_SIZES } from "@/lib/setup";

export type InfoState = { error?: string; ok?: string };
const t = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);

/** Crew: save their own contact, emergency contact, license and shirt size. */
export async function saveMyInfo(_: InfoState, form: FormData): Promise<InfoState> {
  const { supabase, me } = await requireMember();
  if (!me) return { error: "Your account isn't active." };
  const lic = t(form, "has_license", 5);
  const shirt = t(form, "shirt_size", 5);
  const row = {
    crew_id: me.id,
    address: t(form, "address", 200),
    emergency_name: t(form, "emergency_name", 100),
    emergency_relation: t(form, "emergency_relation", 60),
    emergency_phone: t(form, "emergency_phone", 30),
    has_license: lic === "yes" ? true : lic === "no" ? false : null,
    shirt_size: SHIRT_SIZES.includes(shirt) ? shirt : "",
    updated_at: new Date().toISOString(),
  };
  const [{ error }, { error: phoneErr }] = await Promise.all([
    supabase.from("crew_profile").upsert(row),
    supabase.rpc("save_my_phone", { p_phone: t(form, "phone", 30) }),
  ]);
  if (error || phoneErr) return { error: `Couldn't save: ${(error ?? phoneErr)!.message}` };
  revalidatePath("/my-info");
  revalidatePath("/schedule");
  revalidatePath("/");
  revalidatePath("/payroll");
  return { ok: "Saved." };
}
