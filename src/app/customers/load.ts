// Load everything needed to build the customer list. Server only, owner only.
import type { SupabaseClient } from "@supabase/supabase-js";
import { CUSTOMER_INVOICE_COLUMNS, CUSTOMER_JOB_COLUMNS, CUSTOMER_QUOTE_COLUMNS, buildCustomers, type CInvoice, type CJob, type CQuote } from "@/lib/customers";

export async function loadCustomers(supabase: SupabaseClient) {
  const [{ data: q }, { data: j }, { data: i }, { data: p }] = await Promise.all([
    supabase.from("quotes").select(CUSTOMER_QUOTE_COLUMNS).limit(5000),
    supabase.from("jobs").select(CUSTOMER_JOB_COLUMNS).limit(5000),
    supabase.from("invoices").select(CUSTOMER_INVOICE_COLUMNS).limit(5000),
    supabase.from("partners").select("id, name, kind"),
  ]);
  return {
    customers: buildCustomers((q ?? []) as CQuote[], (j ?? []) as CJob[], (i ?? []) as CInvoice[]),
    partners: new Map(((p ?? []) as { id: string; name: string; kind: string }[]).map((x) => [x.id, x])),
  };
}
