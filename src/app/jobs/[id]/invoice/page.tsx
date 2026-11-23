import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { NotActive } from "@/components/NotActive";
import { PageLoading } from "@/components/PageLoading";
import { ROLE_LABEL, requireMember } from "@/lib/crew";
import { fmtDayLong } from "@/lib/dates";
import type { PayMethod } from "@/lib/invoices";
import { JOB_COLUMNS, jobCrew, type Job } from "@/lib/jobs";
import { getPrices } from "@/lib/settings";
import { InvoiceForm } from "./InvoiceForm";

export default function NewInvoicePage({ params }: PageProps<"/jobs/[id]/invoice">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <NewInvoice params={params} />
    </Suspense>
  );
}

async function NewInvoice({ params }: Pick<PageProps<"/jobs/[id]/invoice">, "params">) {
  const { id } = await params;
  const { supabase, me } = await requireMember();
  if (!me) return <NotActive />;

  const { data } = await supabase.from("jobs").select(JOB_COLUMNS).eq("id", id).maybeSingle();
  if (!data) notFound();
  const job = data as Job;
  const isOwner = me.role === "owner";
  if (!isOwner && job.lead_id !== me.id) redirect(`/jobs/${id}`);

  // Already invoiced? Go to it.
  const { data: existing } = await supabase.from("invoices").select("id").eq("job_id", id).maybeSingle();
  if (existing) redirect(`/invoices/${existing.id}`);

  // Miles were copied from the quote when the job was booked (empty if typed in by hand).
  const { data: miles } = await supabase.from("jobs").select("miles_out, miles_between, miles_back").eq("id", id).maybeSingle();
  const m = (miles ?? {}) as { miles_out?: number | null; miles_between?: number | null; miles_back?: number | null };
  const prices = await getPrices(supabase);
  const str = (x: number | null | undefined) => (x == null ? "" : String(x));

  // Show Cash App / Venmo / Zelle / Apple Pay only when Zach has filled them in on the Prices page.
  const enabled: PayMethod[] = ["cash", "check", "card"];
  if (prices.zelle) enabled.push("zelle");
  if (prices.apple_cash) enabled.push("apple_pay");
  if (prices.cashapp) enabled.push("cashapp");
  if (prices.venmo) enabled.push("venmo");

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="Invoice" isOwner={isOwner} name={me.full_name} roleLabel={ROLE_LABEL[me.role]} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 pt-4">
        <div>
          <h1 className="break-words font-display text-3xl font-extrabold uppercase leading-tight text-ink">{job.customer_name}</h1>
          <p className="text-sm text-muted">
            {fmtDayLong(job.job_date)} · {job.job_type}
          </p>
        </div>
        <InvoiceForm
          prices={prices}
          enabledMethods={enabled}
          start={{
            jobId: job.id,
            customerName: job.customer_name,
            hours: str(job.est_hours),
            movers: String(Math.max(prices.min_movers, jobCrew(job).length || job.movers_needed)),
            truck: job.truck,
            miles_out: str(m.miles_out),
            miles_between: str(m.miles_between),
            miles_back: str(m.miles_back),
            nte: job.nte != null ? Number(job.nte) : null,
          }}
        />
      </main>
    </div>
  );
}
