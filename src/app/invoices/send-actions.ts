"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/crew";
import { niceName } from "@/lib/customer-quote";
import { saveInvoiceView } from "@/lib/customer-invoice";
import { INVOICE_COLUMNS, PAY_LABEL, type Invoice } from "@/lib/invoices";
import { money } from "@/lib/pricing";

export type InvoiceSendResult = { error?: string; url?: string; text?: string; subject?: string };

const newToken = () => (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");

/** Zach or the job's lead: make (or refresh) the customer's private invoice link and a ready-to-send message. */
export async function sendInvoiceLink(invoiceId: string): Promise<InvoiceSendResult> {
  const { supabase, me } = await requireMember();
  if (!me) return { error: "Your account isn't active." };
  if (!/^[0-9a-f-]{36}$/i.test(invoiceId)) return { error: "Invoice not found." };
  const { data } = await supabase.from("invoices").select(`${INVOICE_COLUMNS}, share_token`).eq("id", invoiceId).maybeSingle();
  if (!data) return { error: "Invoice not found." };
  const inv = data as Invoice & { share_token: string | null };

  const token = inv.share_token ?? newToken();
  const saved = await saveInvoiceView(supabase, inv);
  if (saved.error) return { error: `Couldn't make the link: ${saved.error.message}` };
  const { error } = await supabase.from("invoices").update({ share_token: token, sent_at: new Date().toISOString() }).eq("id", invoiceId);
  if (error) return { error: `Couldn't make the link: ${error.message}` };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "zmc-app.vercel.app";
  const url = `https://${host}/i/${token}`;
  revalidatePath(`/invoices/${invoiceId}`);

  const first = niceName(inv.customer_name).split(/\s+/)[0] || "there";
  const number = `INV-${inv.id.slice(0, 4).toUpperCase()}`;
  const text = [
    `Hi ${first}, thank you for moving with Zachery's Moving Co.! Here's your invoice:`,
    url,
    "",
    inv.paid_at ? `Total: ${money(Number(inv.total))}, paid by ${PAY_LABEL[inv.payment_method]}. Thank you!` : `Total due: ${money(Number(inv.total))}.`,
    "You can save a copy as a PDF there, and tell us how we did.",
    "",
    "Questions? Call or text (209) 326-5601.",
  ].join("\n");
  return { url, text, subject: `Your invoice from Zachery's Moving Co. (${number})` };
}
