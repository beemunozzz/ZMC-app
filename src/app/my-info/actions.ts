"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/crew";
import { redirect } from "next/navigation";
import { SHIRT_SIZES, SHOE_SIZES } from "@/lib/setup";

export type InfoState = { error?: string; ok?: string };
const t = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);

/** Crew: save their own contact, emergency contact, license and shirt size. */
export async function saveMyInfo(_: InfoState, form: FormData): Promise<InfoState> {
  const { supabase, me } = await requireMember();
  if (!me) return { error: "Your account isn't active." };
  const lic = t(form, "has_license", 5);
  const shirt = t(form, "shirt_size", 5);
  const shoe = t(form, "shoe_size", 5);
  const dob = t(form, "birth_date", 10);
  const dobOk = /^\d{4}-\d{2}-\d{2}$/.test(dob) && dob > "1930-01-01" && dob < new Date().toISOString().slice(0, 10);
  if (dob && !dobOk) return { error: "Check your date of birth." };
  const row = {
    crew_id: me.id,
    address: t(form, "address", 200),
    emergency_name: t(form, "emergency_name", 100),
    emergency_relation: t(form, "emergency_relation", 60),
    emergency_phone: t(form, "emergency_phone", 30),
    has_license: lic === "yes" ? true : lic === "no" ? false : null,
    shirt_size: SHIRT_SIZES.includes(shirt) ? shirt : "",
    shoe_size: SHOE_SIZES.includes(shoe) ? shoe : "",
    birth_date: dobOk ? dob : null,
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
  // The welcome walkthrough moves on to its next step.
  const next = t(form, "next", 80);
  if (next.startsWith("/welcome")) redirect(next);
  return { ok: "Saved." };
}
