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
  return { values: { full_name, email: emailRaw || null, phone, role, active } };
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

  const { error } = await supabase.from("crew_members").insert({ ...parsed.values, active: true });
  if (error) return { error: dbError(error.message) };
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
  revalidatePath("/team");
  return { ok: "Saved." };
}
