"use server";

import { revalidatePath } from "next/cache";
import { requireMember, type Employment, type Role } from "@/lib/crew";
import { isISODate, todayISO } from "@/lib/dates";

export type EmpState = { error?: string; ok?: string };
const UUID = /^[0-9a-f-]{36}$/i;
const ROLES: Role[] = ["owner", "lead", "mover"];
const TYPES: Employment[] = ["full_time", "part_time", "on_call", "leave"];
const t = (f: FormData, k: string, max = 300) => String(f.get(k) ?? "").trim().slice(0, max);

function refresh(id: string) {
  revalidatePath(`/payroll/${id}`);
  revalidatePath("/payroll");
  revalidatePath("/team");
  revalidatePath("/");
}

/** Save contact info, role and employment type. */
export async function saveEmployee(_: EmpState, form: FormData): Promise<EmpState> {
  const { supabase, me } = await requireMember();
  if (me?.role !== "owner") return { error: "Only Zach can change employee files." };
  const id = t(form, "id", 40);
  if (!UUID.test(id)) return { error: "Employee not found." };

  const full_name = t(form, "full_name", 120);
  const email = t(form, "email", 200).toLowerCase() || null;
  const role = t(form, "role", 10) as Role;
  const employment = t(form, "employment", 12) as Employment;
  const hire = t(form, "hire_date", 10);
  if (!full_name) return { error: "Add a name." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "That email doesn't look right." };
  if (!ROLES.includes(role)) return { error: "Pick a role." };
  if (!TYPES.includes(employment)) return { error: "Pick an employment type." };
  if (hire && !isISODate(hire)) return { error: "That start date doesn't look right." };
  if (id === me.id && role !== "owner") return { error: "You can't remove your own owner access." };

  const { error } = await supabase
    .from("crew_members")
    .update({ full_name, email, phone: t(form, "phone", 40) || null, role, employment })
    .eq("id", id);
  if (error) return { error: error.message.includes("unique") ? "Someone else already uses that email." : `Couldn't save: ${error.message}` };

  const { error: e2 } = await supabase.from("crew_pay").upsert(
    {
      crew_id: id,
      address: t(form, "address", 300),
      emergency_name: t(form, "emergency_name", 120),
      emergency_phone: t(form, "emergency_phone", 40),
      hire_date: hire || null,
      notes: t(form, "notes", 2000),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "crew_id" },
  );
  if (e2) return { error: `Saved the basics, but not the private info: ${e2.message}` };
  refresh(id);
  return { ok: "Saved." };
}

/** Give a raise (or any pay change), and keep a record of it. */
export async function giveRaise(_: EmpState, form: FormData): Promise<EmpState> {
  const { supabase, me } = await requireMember();
  if (me?.role !== "owner") return { error: "Only Zach can change pay." };
  const id = t(form, "id", 40);
  const rate = Number(t(form, "new_rate", 10).replace(/^\$/, ""));
  const date = t(form, "effective_date", 10) || todayISO();
  if (!UUID.test(id)) return { error: "Employee not found." };
  if (!Number.isFinite(rate) || rate < 0 || rate > 500) return { error: "Enter the new hourly pay, like 24 or 24.50." };
  if (!isISODate(date)) return { error: "Pick the date it starts." };

  const { data: cur } = await supabase.from("crew_pay").select("hourly_rate").eq("crew_id", id).maybeSingle();
  const old = cur?.hourly_rate == null ? null : Number(cur.hourly_rate);
  const { error } = await supabase.from("pay_changes").insert({ crew_id: id, old_rate: old, new_rate: rate, effective_date: date, note: t(form, "note", 300) });
  if (error) return { error: `Couldn't save: ${error.message}` };
  await supabase.from("crew_pay").upsert({ crew_id: id, hourly_rate: rate, updated_at: new Date().toISOString() }, { onConflict: "crew_id" });
  refresh(id);
  return { ok: old != null && rate > old ? `Raise saved: $${old.toFixed(2)} → $${rate.toFixed(2)} per hour.` : `Pay saved: $${rate.toFixed(2)} per hour.` };
}

/** Terminate: the database turns off the account, blocks the login, signs out every phone, and takes them off upcoming jobs. */
export async function terminateEmployee(_: EmpState, form: FormData): Promise<EmpState> {
  const { supabase, me } = await requireMember();
  if (me?.role !== "owner") return { error: "Only Zach can terminate an employee." };
  const id = t(form, "id", 40);
  const date = t(form, "termination_date", 10) || todayISO();
  if (!UUID.test(id)) return { error: "Employee not found." };
  if (id === me.id) return { error: "You can't terminate yourself." };
  if (form.get("sure") !== "yes") return { error: "Tap “Yes, terminate” to confirm." };
  const { data, error } = await supabase.rpc("terminate_employee", { p_crew: id, p_date: isISODate(date) ? date : todayISO(), p_reason: t(form, "reason", 300) });
  if (error) {
    if (error.message.includes("Could not find the function")) return { error: "Terminate isn't set up yet in the database (setup step 11)." };
    return { error: error.message.replace(/^ZMC: /, "") };
  }
  refresh(id);
  const n = (data as { jobs_updated?: number } | null)?.jobs_updated ?? 0;
  return { ok: `Terminated. Their login is turned off${n ? `, and they were taken off ${n} upcoming job${n === 1 ? "" : "s"} (those now need crew)` : ""}.` };
}

export async function rehireEmployee(_: EmpState, form: FormData): Promise<EmpState> {
  const { supabase, me } = await requireMember();
  if (me?.role !== "owner") return { error: "Only Zach can rehire an employee." };
  const id = t(form, "id", 40);
  if (!UUID.test(id)) return { error: "Employee not found." };
  const { error } = await supabase.rpc("rehire_employee", { p_crew: id });
  if (error) {
    if (error.message.includes("Could not find the function")) return { error: "Rehire isn't set up yet in the database (setup step 11)." };
    return { error: error.message.replace(/^ZMC: /, "") };
  }
  refresh(id);
  return { ok: "Rehired. They can log in again. Put them back on jobs from the schedule." };
}

/** Dashboard: "Is this on-call person still working tomorrow?" No = take them off that job. */
export async function answerOnCall(form: FormData) {
  const { supabase, me } = await requireMember();
  if (me?.role !== "owner") return;
  const jobId = t(form, "job_id", 40);
  const crewId = t(form, "crew_id", 40);
  const answer = t(form, "answer", 3) === "no" ? "no" : "yes";
  if (!UUID.test(jobId) || !UUID.test(crewId)) return;
  if (answer === "no") {
    const { data: job } = await supabase.from("jobs").select("lead_id, crew_ids").eq("id", jobId).maybeSingle();
    if (job) {
      await supabase
        .from("jobs")
        .update({ lead_id: job.lead_id === crewId ? null : job.lead_id, crew_ids: (job.crew_ids as string[]).filter((c) => c !== crewId) })
        .eq("id", jobId);
    }
  }
  await supabase
    .from("oncall_checks")
    .upsert({ job_id: jobId, crew_id: crewId, answer, answered_at: new Date().toISOString() }, { onConflict: "job_id,crew_id" });
  revalidatePath("/");
}
