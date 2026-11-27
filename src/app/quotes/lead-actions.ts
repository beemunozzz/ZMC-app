"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/crew";
import { HEARD_FROM, LOST_REASONS, type QuoteStatus } from "@/lib/quotes";

const UUID = /^[0-9a-f-]{36}$/i;
const STAGES: QuoteStatus[] = ["new", "contacted", "quoted", "follow_up", "booked", "lost"];
const text = (form: FormData, key: string, max = 200) => String(form.get(key) ?? "").trim().slice(0, max);

function refresh(id?: string) {
  revalidatePath("/quotes");
  revalidatePath("/");
  if (id) revalidatePath(`/quotes/${id}`);
}

/** Zach: a new lead in a few seconds (call, text, walk-in). The full quote can be filled in later. */
export async function createLead(form: FormData) {
  const { supabase, me } = await requireMember();
  if (me?.role !== "owner") return;
  const name = text(form, "customer_name", 120);
  if (!name) return;
  const heard = text(form, "heard_from", 60);
  const { data } = await supabase
    .from("quotes")
    .insert({
      status: "new",
      customer_name: name,
      customer_phone: text(form, "customer_phone", 40),
      heard_from: HEARD_FROM.includes(heard) ? heard : "",
      notes: text(form, "notes", 2000),
      source: "lead",
      job_type: "Full move",
      truck: "ours",
      movers: 2,
    })
    .select("id")
    .single();
  refresh();
  if (data?.id && form.get("open") === "1") redirect(`/quotes/${data.id}`);
}

/** The first reply to the customer (call or text). Stops the "no reply yet" timer. */
export async function markContacted(id: string): Promise<void> {
  const { supabase, me } = await requireMember();
  if (me?.role !== "owner" || !UUID.test(id)) return;
  await supabase.from("quotes").update({ contacted_at: new Date().toISOString() }).eq("id", id).is("contacted_at", null);
  await supabase.from("quotes").update({ status: "contacted" }).eq("id", id).eq("status", "new");
  refresh(id);
}

/** Move a lead to a stage. "Lost" needs a reason. */
export async function setStage(form: FormData) {
  const { supabase, me } = await requireMember();
  if (me?.role !== "owner") return;
  const id = text(form, "id", 40);
  const stage = text(form, "stage", 12) as QuoteStatus;
  if (!UUID.test(id) || !STAGES.includes(stage) || stage === "booked") return; // booking makes the job: use Book it
  const reason = text(form, "lost_reason", 60);
  const lost_reason = stage === "lost" ? (LOST_REASONS.includes(reason) ? reason : "Other") : "";
  await supabase.from("quotes").update({ status: stage, lost_reason }).eq("id", id);
  if (stage !== "new") await supabase.from("quotes").update({ contacted_at: new Date().toISOString() }).eq("id", id).is("contacted_at", null);
  refresh(id);
}
