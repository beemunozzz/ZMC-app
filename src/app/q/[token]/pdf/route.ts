// Download the customer's estimate as a real one-page PDF (same on every phone and computer).
// No login: the long code in the link is the key, same as the estimate page.
import { createClient } from "@supabase/supabase-js";
import type { CustomerView } from "@/lib/customer-quote";
import { renderQuotePdf } from "@/lib/quote-pdf";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

type Row = { view: CustomerView; accepted_at: string | null; signed_name: string | null; signature: string | null };

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!/^[0-9a-f]{40,80}$/.test(token)) return new Response("Not found", { status: 404 });
  const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const { data } = await db.rpc("public_quote", { p_token: token });
  const row = ((data ?? []) as Row[])[0];
  if (!row?.view) return new Response("Not found", { status: 404 });

  const signed = row.accepted_at
    ? {
        name: row.signed_name,
        signature: row.signature,
        date: new Date(row.accepted_at).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric" }),
      }
    : null;
  const pdf = await renderQuotePdf(row.view, signed);
  const name = `ZMC-Estimate-${row.view.number}${signed ? "-signed" : ""}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
