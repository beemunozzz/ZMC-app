"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/crew";

/** Zach's private note about a customer (by the customer's key). */
export async function saveCustomerNote(form: FormData) {
  const { supabase, me } = await requireMember();
  if (me?.role !== "owner") return;
  const key = String(form.get("key") ?? "").slice(0, 120);
  if (!/^(\d{7,10}|n-[a-z0-9-]+)$/.test(key)) return;
  const note = String(form.get("note") ?? "").slice(0, 4000);
  await supabase.from("customer_notes").upsert({ phone_key: key, note, updated_at: new Date().toISOString() }, { onConflict: "phone_key" });
  revalidatePath(`/customers/${key}`);
}
