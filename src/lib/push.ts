// Sends phone notifications (free "web push"). Server only.
// Needs two settings in Vercel: VAPID_PUBLIC_KEY (Config) and VAPID_PRIVATE_KEY (Secret).
import webpush from "web-push";

type Db = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };
export type PushMessage = { title: string; body: string; url?: string; tag?: string };

export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY ?? "";
export const pushReady = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

/**
 * Notify crew members' phones (and/or every owner's). Never throws: a notification
 * that can't be sent must not break saving a job or an invoice.
 */
export async function notify(supabase: Db, to: { crew?: string[]; owners?: boolean }, msg: PushMessage) {
  if (!pushReady()) return;
  try {
    webpush.setVapidDetails("https://zmc-app.vercel.app", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    const { data } = await supabase.rpc("push_targets", { p_crew: to.crew ?? [], p_owners: !!to.owners });
    const targets = (data ?? []) as { endpoint: string; p256dh: string; auth: string }[];
    const payload = JSON.stringify({ title: msg.title, body: msg.body, url: msg.url ?? "/", tag: msg.tag });
    await Promise.all(
      targets.map(async (t) => {
        try {
          await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, payload, { TTL: 6 * 3600, urgency: "high" });
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await supabase.rpc("drop_push_endpoint", { p_endpoint: t.endpoint });
        }
      }),
    );
  } catch {
    /* notifications are best-effort */
  }
}

/** Send to phones directly (the nightly reminder, which runs without anyone logged in). Returns how many went out. */
export async function sendPush(targets: { endpoint: string; p256dh: string; auth: string; msg: PushMessage }[]) {
  if (!pushReady() || !targets.length) return 0;
  webpush.setVapidDetails("https://zmc-app.vercel.app", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  let sent = 0;
  await Promise.all(
    targets.map(async (t) => {
      try {
        await webpush.sendNotification(
          { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
          JSON.stringify({ title: t.msg.title, body: t.msg.body, url: t.msg.url ?? "/", tag: t.msg.tag }),
          { TTL: 6 * 3600, urgency: "normal" },
        );
        sent++;
      } catch {
        /* an old phone that's gone; it's cleaned up next time someone logged in sends to it */
      }
    }),
  );
  return sent;
}
