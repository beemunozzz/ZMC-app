"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/crew";
import { todayISO } from "@/lib/dates";
import { buildCustomerView, niceName } from "@/lib/customer-quote";
import { QUOTE_COLUMNS, type Quote } from "@/lib/quotes";
import { getPrices } from "@/lib/settings";

export type SendResult = { error?: string; url?: string; text?: string; accepted?: boolean };

const newToken = () => (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");

/**
 * Owner: make (or refresh) the customer's private link for a saved quote. Freezes the customer-facing
 * numbers so they can't change under the customer. Once the customer has signed, the link is just returned.
 */
export async function sendQuoteLink(quoteId: string): Promise<SendResult> {
  const { supabase, me } = await requireMember();
  if (me?.role !== "owner") return { error: "Only the owner can send quotes." };
  if (!/^[0-9a-f-]{36}$/i.test(quoteId)) return { error: "Save the quote first." };
  const { data } = await supabase.from("quotes").select(`${QUOTE_COLUMNS}, share_token, accepted_at`).eq("id", quoteId).maybeSingle();
  if (!data) return { error: "Save the quote first." };
  const q = data as Quote & { share_token: string | null; accepted_at: string | null };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "zmc-app.vercel.app";
  const link = (t: string) => `https://${host}/q/${t}`;

  if (q.accepted_at && q.share_token) return { url: link(q.share_token), accepted: true, text: messageFor(q.customer_name, link(q.share_token)) };
  if (!q.move_date) return { error: "Add the move date before sending." };
  if (!q.nte) return { error: "Set the not-to-exceed price before sending." };

  const prices = await getPrices(supabase);
  const today = todayISO();
  const view = buildCustomerView(q, prices, today);
  const token = q.share_token ?? newToken();
  const { error } = await supabase
    .from("quotes")
    .update({
      share_token: token,
      customer_view: view,
      sent_at: new Date().toISOString(),
      valid_until: view.valid_until,
      ...(q.status === "new" ? { status: "quoted" } : {}),
    })
    .eq("id", quoteId);
  if (error) return { error: `Couldn't make the link: ${error.message}` };
  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath("/quotes");
  return { url: link(token), text: messageFor(q.customer_name, link(token)) };
}

function messageFor(name: string, url: string) {
  const first = niceName(name).split(/\s+/)[0] || "there";
  return [
    `Hi ${first}, here's your moving estimate from Zachery's Moving Co.:`,
    url,
    "",
    "Review it and sign to book your move right from that page.",
    "Once you sign, you can save a copy as a PDF.",
    "",
    "Questions? Call or text (209) 326-5601.",
  ].join("\n");
}
