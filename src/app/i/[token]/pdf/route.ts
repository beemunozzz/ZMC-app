// Download the customer's invoice as a real one-page PDF. No login: the long code in the link is the key.
import { createClient } from "@supabase/supabase-js";
import type { InvoiceRow } from "@/lib/customer-invoice";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!/^[0-9a-f]{40,80}$/.test(token)) return new Response("Not found", { status: 404 });
  const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const { data } = await db.rpc("public_invoice", { p_token: token });
  const row = ((data ?? []) as InvoiceRow[])[0];
  if (!row?.view) return new Response("Not found", { status: 404 });

  const pdf = await renderInvoicePdf(row);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="ZMC-Invoice-${row.view.number}${row.paid_at ? "-paid" : ""}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
