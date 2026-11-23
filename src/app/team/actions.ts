"use server";

import { revalidatePath } from "next/cache";
import { requireMember, type Role } from "@/lib/crew";

export type FormState = { error?: string; ok?: string };

const ROLES: Role[] = ["owner", "lead", "mover"];

function read(form: FormData) {
  const full_name = String(form.get("full_name") ?? "").trim();
  const emailRaw = String(form.get("email") ?? "").trim().toLowerCase();
  const phone = String(form.get("phone") ?? "").trim() || null;
  const role = String(form.get("role") ?? "mover") as Role;
  const active = form.get("active") !== "off";
  if (!full_name) return { error: "Add a name." };
  if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) return { error: "That email doesn't look right." };
  if (!ROLES.includes(role)) return { error: "Pick a role." };
  const rateRaw = String(form.get("hourly_rate") ?? "").trim().replace(/^\$/, "");
  const hourly_rate = rateRaw ? Number(rateRaw) : null;
  if (hourly_rate != null && (!Number.isFinite(hourly_rate) || hourly_rate < 0 || hourly_rate > 500))
    return { error: "Hourly pay should be a dollar amount, like 22 or 22.50." };
  return { values: { full_name, email: emailRaw || null, phone, role, active }, hourly_rate };
}

/** Pay rates live in their own owner-only table. */
async function savePay(supabase: Awaited<ReturnType<typeof requireMember>>["supabase"], crewId: string, rate: number | null) {
  const { error } = await supabase
    .from("crew_pay")
    .upsert({ crew_id: crewId, hourly_rate: rate, updated_at: new Date().toISOString() }, { onConflict: "crew_id" });
  return error;
}

function dbError(message: string) {
  if (message.includes("duplicate") || message.includes("unique")) return "Someone on the crew already uses that email.";
  if (message.includes("row-level security")) return "Only the owner can change the crew list.";
  return message;
}

export async function addMember(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, me } = await requireMember();
  if (me?.role !== "owner") return { error: "Only the owner can add crew." };
  const parsed = read(form);
  if (!parsed.values) return { error: parsed.error };

  const { data, error } = await supabase.from("crew_members").insert({ ...parsed.values, active: true }).select("id").single();
  if (error) return { error: dbError(error.message) };
  const payError = await savePay(supabase, data.id, parsed.hourly_rate);
  if (payError) return { error: `${parsed.values.full_name} was added, but the pay rate didn't save: ${payError.message}` };
  revalidatePath("/team");
  return { ok: `${parsed.values.full_name} added.` };
}

export async function updateMember(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, me } = await requireMember();
  if (me?.role !== "owner") return { error: "Only the owner can change the crew list." };
  const id = String(form.get("id") ?? "");
  const parsed = read(form);
  if (!parsed.values) return { error: parsed.error };

  if (id === me.id && (parsed.values.role !== "owner" || !parsed.values.active)) {
    return { error: "You can't remove your own owner access. Ask another owner to do it." };
  }

  const { error } = await supabase.from("crew_members").update(parsed.values).eq("id", id);
  if (error) return { error: dbError(error.message) };
  const payError = await savePay(supabase, id, parsed.hourly_rate);
  if (payError) return { error: `Saved, but the pay rate didn't save: ${payError.message}` };
  revalidatePath("/team");
  return { ok: "Saved." };
}
