import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { NotActive } from "@/components/NotActive";
import { PageLoading } from "@/components/PageLoading";
import { roleLabel, requireMember } from "@/lib/crew";
import { fmtDayLong } from "@/lib/dates";
import type { PayMethod } from "@/lib/invoices";
import { JOB_COLUMNS, jobCrew, type Job } from "@/lib/jobs";
import { getClockInEnabled, getPrices } from "@/lib/settings";
import { TIME_COLUMNS, entryHours, roundUpQuarter, type TimeEntry } from "@/lib/time";
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
  const { data: miles } = await supabase.from("jobs").select("miles_out, miles_between, miles_back, drive_min, drive_back_min, flat_price, rate_override").eq("id", id).maybeSingle();
  const m = (miles ?? {}) as {
    miles_out?: number | null;
    miles_between?: number | null;
    miles_back?: number | null;
    drive_min?: number | null;
    drive_back_min?: number | null;
    flat_price?: number | null;
    rate_override?: number | null;
  };
  const prices = await getPrices(supabase);
  const str = (x: number | null | undefined) => (x == null ? "" : String(x));

  // With clock-in on, use the real time on the job: the crew lead's entries, or everyone's span if the lead didn't clock in.
  let clockedHours: number | null = null;
  if (await getClockInEnabled(supabase)) {
    const { data: t } = await supabase.from("time_entries").select(TIME_COLUMNS).eq("job_id", id);
    const entries = (t ?? []) as TimeEntry[];
    const lead = entries.filter((e) => e.crew_id === job.lead_id);
    if (lead.length) clockedHours = lead.reduce((s, e) => s + entryHours(e), 0);
    else if (entries.length) {
      const first = Math.min(...entries.map((e) => Date.parse(e.clock_in)));
      const last = Math.max(...entries.map((e) => Date.parse(e.clock_in) + entryHours(e) * 3_600_000));
      clockedHours = (last - first) / 3_600_000;
    }
    if (clockedHours != null) clockedHours = roundUpQuarter(clockedHours);
  }

  // Show Cash App / Venmo / Zelle / Apple Pay only when Zach has filled them in on the Prices page.
  const enabled: PayMethod[] = ["cash", "check", "card"];
  if (prices.zelle) enabled.push("zelle");
  if (prices.apple_cash) enabled.push("apple_pay");
  if (prices.cashapp) enabled.push("cashapp");
  if (prices.venmo) enabled.push("venmo");

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="Invoice" isOwner={isOwner} name={me.full_name} roleLabel={roleLabel(me)} />
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
            hours: clockedHours != null ? String(clockedHours) : str(job.est_hours),
            hoursFrom: clockedHours != null ? "clock" : "estimate",
            movers: String(Math.max(prices.min_movers, jobCrew(job).length || job.movers_needed)),
            truck: job.truck,
            miles_out: str(m.miles_out),
            miles_between: str(m.miles_between),
            miles_back: str(m.miles_back),
            driveOut: m.drive_min ?? null,
            driveBack: m.drive_back_min ?? null,
            flatPrice: m.flat_price != null ? Number(m.flat_price) : null,
            rateOverride: m.rate_override != null ? Number(m.rate_override) : null,
            nte: job.nte != null ? Number(job.nte) : null,
          }}
        />
      </main>
    </div>
  );
}
