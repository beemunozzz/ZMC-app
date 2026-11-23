import Link from "next/link";
import QRCode from "qrcode";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { NotActive } from "@/components/NotActive";
import { PageLoading } from "@/components/PageLoading";
import { TextLink } from "@/components/TextButtons";
import { ROLE_LABEL, requireMember } from "@/lib/crew";
import { fmtDayLong } from "@/lib/dates";
import { INVOICE_COLUMNS, PAY_LABEL, PAY_METHODS, payLink, receiptText, type Invoice, type PayMethod } from "@/lib/invoices";
import { money, type Prices } from "@/lib/pricing";
import { getPrices } from "@/lib/settings";
import { changeMethod, markPaid } from "../actions";
import { CopyButton } from "./CopyButton";

export default function InvoicePage({ params, searchParams }: PageProps<"/invoices/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <InvoiceView params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const qrSvg = (text: string) => QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#15202b", light: "#ffffff" } });

async function GetPaid({ inv, prices }: { inv: Invoice; prices: Prices }) {
  const total = Number(inv.total);
  const link = payLink(inv.payment_method, total, prices, "ZMC move");
  const big = "font-display text-4xl font-extrabold tabular-nums text-ink";
  const qr = link ? await qrSvg(link) : null;

  const handle = (value: string, label: string) => (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-bg p-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
        <p className="break-all text-lg font-semibold text-ink">{value}</p>
      </div>
      <CopyButton text={value} />
    </div>
  );

  let body: React.ReactNode;
  switch (inv.payment_method as PayMethod) {
    case "cash":
      body = <p className="text-[15px] text-ink">Collect <b className="tabular-nums">{money(total)}</b> in cash, then tap Mark as paid.</p>;
      break;
    case "check":
      body = <p className="text-[15px] text-ink">Collect a check for <b className="tabular-nums">{money(total)}</b> made out to <b>Zachery&apos;s Moving Co.</b>, then tap Mark as paid.</p>;
      break;
    case "zelle":
      body = (
        <>
          <p className="text-[15px] text-ink">In your bank app, send <b className="tabular-nums">{money(total)}</b> with Zelle to:</p>
          {prices.zelle ? handle(prices.zelle, "Zelle") : <p className="text-sm text-warn">Zach&apos;s Zelle info isn&apos;t set up yet (☰ → Prices).</p>}
        </>
      );
      break;
    case "apple_pay":
      body = (
        <>
          <p className="text-[15px] text-ink">On your iPhone, send <b className="tabular-nums">{money(total)}</b> with Apple Cash in Messages to:</p>
          {prices.apple_cash ? handle(prices.apple_cash, "Apple Cash") : <p className="text-sm text-warn">Zach&apos;s Apple Cash number isn&apos;t set up yet (☰ → Prices).</p>}
        </>
      );
      break;
    case "card":
      body = (
        <p className="text-[15px] text-ink">
          Run <b className="tabular-nums">{money(total)}</b> on the card reader, then tap Mark as paid.{" "}
          <span className="text-muted">Taking cards right in the app comes later with Square or Stripe.</span>
        </p>
      );
      break;
    case "cashapp":
    case "venmo":
      body = link ? (
        <>
          <p className="text-[15px] text-ink">
            Scan with your phone camera, or tap the button. The amount <b className="tabular-nums">{money(total)}</b> is filled in.
          </p>
          <div className="mx-auto w-56 rounded-2xl bg-white p-3" dangerouslySetInnerHTML={{ __html: qr! }} role="img" aria-label={`QR code to pay with ${PAY_LABEL[inv.payment_method]}`} />
          <a href={link} target="_blank" rel="noopener" className="press flex h-12 items-center justify-center rounded-xl bg-primary font-semibold text-white dark:text-navy">
            Open {PAY_LABEL[inv.payment_method]}
          </a>
          {handle(inv.payment_method === "cashapp" ? prices.cashapp : prices.venmo, PAY_LABEL[inv.payment_method])}
        </>
      ) : (
        <p className="text-sm text-warn">Zach&apos;s {PAY_LABEL[inv.payment_method]} info isn&apos;t set up yet (☰ → Prices).</p>
      );
      break;
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border-2 border-primary/40 bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-extrabold uppercase text-ink">Get paid · {PAY_LABEL[inv.payment_method]}</h2>
        <span className={big}>{money(total)}</span>
      </div>
      {body}
    </section>
  );
}

async function InvoiceView({ params, searchParams }: Pick<PageProps<"/invoices/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, me } = await requireMember();
  if (!me) return <NotActive />;
  const isOwner = me.role === "owner";

  const { data } = await supabase.from("invoices").select(INVOICE_COLUMNS).eq("id", id).maybeSingle();
  if (!data) notFound();
  const inv = data as Invoice;
  const [{ data: job }, prices] = await Promise.all([
    supabase.from("jobs").select("id, job_date, job_type, pickup_address, dropoff_address").eq("id", inv.job_id).maybeSingle(),
    getPrices(supabase),
  ]);
  const jobDate = (job?.job_date as string) ?? inv.created_at.slice(0, 10);
  const paid = !!inv.paid_at;
  const truckMiles = (Number(inv.miles_out) || 0) + (Number(inv.miles_between) || 0) + (Number(inv.miles_back) || 0);

  const row = (label: React.ReactNode, amount: number) => (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <span className="min-w-0 text-ink">{label}</span>
      <span className="shrink-0 font-semibold tabular-nums text-ink">{money(Number(amount))}</span>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="Invoice" isOwner={isOwner} name={me.full_name} roleLabel={ROLE_LABEL[me.role]} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4">
        <Link href={`/jobs/${inv.job_id}`} className="text-sm font-semibold text-primary">
          ‹ Back to the job
        </Link>

        {sp.new && !paid && <p className="rise rounded-xl bg-ok/12 px-4 py-3 text-sm font-medium text-ok">✓ Invoice saved and signed. Now collect payment.</p>}

        <div className="flex items-center gap-2">
          <h1 className="min-w-0 break-words font-display text-3xl font-extrabold uppercase leading-tight text-ink">{inv.customer_name}</h1>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${paid ? "bg-ok/12 text-ok" : "bg-warn/12 text-warn"}`}>
            {paid ? "Paid" : "Waiting for payment"}
          </span>
        </div>

        {/* Get paid comes first: it's the one thing to do now. */}
        {paid ? (
          <section className="flex items-center gap-3 rounded-2xl bg-ok/12 p-4">
            <span className="pop flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ok text-xl text-white dark:text-navy" aria-hidden>
              ✓
            </span>
            <div>
              <p className="font-semibold text-ok">
                Paid {money(Number(inv.total))} by {PAY_LABEL[inv.payment_method]}
              </p>
              <p className="text-sm text-muted">
                {new Date(inv.paid_at!).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </p>
            </div>
          </section>
        ) : (
          <>
            <GetPaid inv={inv} prices={prices} />
            <form action={markPaid}>
              <input type="hidden" name="id" value={inv.id} />
              <button className="press flex h-14 w-full items-center justify-center rounded-xl bg-ok text-lg font-semibold text-white dark:text-navy">
                ✓ Mark as paid
              </button>
            </form>
            <details className="rounded-xl border border-line bg-card px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-primary">Customer wants to pay a different way</summary>
              <form action={changeMethod} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <input type="hidden" name="id" value={inv.id} />
                {PAY_METHODS.filter((m) => m.key !== inv.payment_method).map((m) => (
                  <button key={m.key} name="payment_method" value={m.key} className="press h-12 rounded-xl border border-line text-sm font-semibold text-ink">
                    {m.label}
                  </button>
                ))}
              </form>
            </details>
          </>
        )}

        {/* The invoice */}
        <section className="flex flex-col gap-1 rounded-2xl border border-line bg-card p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-extrabold uppercase text-ink">Zachery&apos;s Moving Co.</h2>
            <span className="text-xs text-muted">{prices.business_phone}</span>
          </div>
          <p className="text-sm text-muted">
            {fmtDayLong(jobDate)}
            {job?.job_type ? ` · ${job.job_type}` : ""}
          </p>
          <div className="mt-2 divide-y divide-line">
            {row(<>Labor · {inv.movers} movers × {Number(inv.hours)} hrs × {money(prices.rate)}</>, inv.labor)}
            {row(<>Trip charge · {(Number(inv.miles_out) || 0) + (Number(inv.miles_back) || 0)} mi out and back</>, inv.trip)}
            {inv.truck === "ours" && row(<>Truck · {truckMiles} mi</>, inv.truck_charge)}
          </div>
          <div className="flex items-baseline justify-between border-t-2 border-ink pt-2">
            <span className="font-display text-xl font-extrabold uppercase text-ink">Total</span>
            <span className="font-display text-3xl font-extrabold tabular-nums text-ink">{money(Number(inv.total))}</span>
          </div>
          <p className="text-xs tabular-nums text-muted">Written not-to-exceed price: {money(Number(inv.nte))}</p>

          <div className="mt-3 rounded-xl border border-line bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- signature is stored as a small picture */}
            <img src={inv.signature} alt={`Signature of ${inv.signed_name}`} className="h-24 w-full object-contain" />
          </div>
          <p className="text-sm text-ink">
            Signed by <b>{inv.signed_name}</b>
            <span className="text-muted">
              {" · "}
              {new Date(inv.signed_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </span>
          </p>
        </section>

        <TextLink phone={inv.customer_phone} body={receiptText(inv, jobDate, prices)} label="Text the customer a receipt" />

        {paid && isOwner && (
          <form action={markPaid} className="pb-4">
            <input type="hidden" name="id" value={inv.id} />
            <input type="hidden" name="undo" value="1" />
            <button className="text-sm font-semibold text-muted">Undo &ldquo;paid&rdquo;</button>
          </form>
        )}
      </main>
    </div>
  );
}
