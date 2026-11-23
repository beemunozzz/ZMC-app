"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/crew";
import { notify, pushReady } from "@/lib/push";

export type PushState = { error?: string; ok?: string };

/** Save this phone so it can get notifications. */
export async function savePhone(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, device: string): Promise<PushState> {
  const { supabase, me } = await requireMember();
  if (!me) return { error: "Your account isn't active." };
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) return { error: "This phone didn't give a notification address." };
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  const { error } = await supabase
    .from("push_subscriptions")
    .insert({ crew_id: me.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, device: device.slice(0, 80) });
  if (error) return { error: `Couldn't save: ${error.message}` };
  revalidatePath("/notifications");
  return { ok: "Notifications are on for this phone." };
}

export async function removePhone(endpoint: string) {
  const { supabase, me } = await requireMember();
  if (!me || !endpoint) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  revalidatePath("/notifications");
}

export async function sendTest(): Promise<PushState> {
  const { supabase, me } = await requireMember();
  if (!me) return { error: "Your account isn't active." };
  if (!pushReady()) return { error: "Notifications aren't set up yet. Zach (or Brandon) needs to add the two keys in Vercel first." };
  await notify(supabase, { crew: [me.id] }, { title: "ZMC Hub", body: `It works, ${me.full_name.split(" ")[0]}! You'll get job updates here.`, url: "/notifications", tag: "test" });
  return { ok: "Sent. It should pop up in a few seconds." };
}
