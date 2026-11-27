"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/crew";
import { PARTNER_KINDS } from "@/lib/partners";

const text = (form: FormData, key: string, max = 200) => String(form.get(key) ?? "").trim().slice(0, max);

export async function addPartner(form: FormData) {
  const { supabase, me } = await requireMember();
  if (me?.role !== "owner") return;
  const name = text(form, "name", 120);
  if (!name) return;
  const kind = text(form, "kind", 40);
  await supabase.from("partners").insert({
    name,
    kind: PARTNER_KINDS.includes(kind) ? kind : "Other",
    phone: text(form, "phone", 40),
    email: text(form, "email", 200),
    notes: text(form, "notes", 1000),
  });
  revalidatePath("/partners");
}

export async function removePartner(form: FormData) {
  const { supabase, me } = await requireMember();
  if (me?.role !== "owner") return;
  const id = text(form, "id", 40);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await supabase.from("partners").delete().eq("id", id); // their past referrals stay; the quotes just lose the link
  revalidatePath("/partners");
}
