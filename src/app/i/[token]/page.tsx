import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { payLines, type InvoiceRow } from "@/lib/customer-invoice";
import { fmtDayLong, fmtTime } from "@/lib/dates";
import { PAY_LABEL, payLink } from "@/lib/invoices";
import { money, type Prices } from "@/lib/pricing";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import "../../q/[token]/quote-doc.css";
import { RateMove } from "./RateMove";

export const metadata: Metadata = {
  title: "Your invoice · Zachery's Moving Co.",
  robots: { index: false, follow: false },
};


export default function CustomerInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<div className="qwrap" />}>
      <CustomerInvoice params={params} />
    </Suspense>
  );
}

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const shortDate = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
const tsDate = (ts: string) =>
  new Date(ts).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric" });
const fmtTravel = (m: number) => (m < 60 ? `${m} minutes` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`);


async function CustomerInvoice({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  if (!/^[0-9a-f]{40,80}$/.test(token)) notFound();
  const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const [{ data }, { data: rateRows }] = await Promise.all([
    db.rpc("public_invoice", { p_token: token }),
    db.rpc("public_invoice_rating", { p_token: token }),
  ]);
  const rated = ((rateRows ?? []) as { rating: number | null; review_url: string }[])[0];
  const row = ((data ?? []) as InvoiceRow[])[0];
  if (!row?.view) notFound();
  const v = row.view;
  const paid = !!row.paid_at;
  const flat = v.pricing === "flat";
  const ourTruck = v.truck === "ours";
  const crewLine = `${v.movers} movers${ourTruck ? " + our 26' box truck" : ""}`;
  const verified = row.hours_verified_at ? tsDate(row.hours_verified_at) : "";
  const asPrices = { cashapp: v.pay.cashapp, venmo: v.pay.venmo } as Prices;
  const appLinks = paid
    ? []
    : (["venmo", "cashapp"] as const)
        .map((m) => ({ m, href: payLink(m, v.total, asPrices, `ZMC move ${v.number}`) }))
        .filter((x): x is { m: "venmo" | "cashapp"; href: string } => !!x.href);

  return (
    <div className="qwrap">
      <div className="no-print mx-auto mb-3 flex max-w-[8.5in] items-center justify-between gap-3 px-1">
        <p className="text-sm font-medium text-[#3a4652]">{paid ? "✓ Paid in full" : "Your invoice"}</p>
      </div>

      <article className="qdoc">
        <header className="head">
          <div>
            <div className="brand">
              <div className="logo">ZMC.</div>
              <svg viewBox="0 0 64 32" aria-hidden="true">
                <path fill="#15202B" d="M2 5.5A1.5 1.5 0 0 1 3.5 4h35A1.5 1.5 0 0 1 40 5.5V24H2z" />
                <path fill="#15202B" d="M41.5 10h9.2c.5 0 1 .2 1.3.6l6.2 6.6c.3.3.4.7.4 1.1V24H41.5z" />
                <path fill="#F3F0EA" d="M44 12.2h6.1l4.6 4.9H44z" />
                <rect x="2" y="20.4" width="38" height="1.4" fill="#D9A25B" />
                <circle cx="12" cy="25.5" r="4.6" fill="#15202B" stroke="#fff" strokeWidth="1.6" />
                <circle cx="50" cy="25.5" r="4.6" fill="#15202B" stroke="#fff" strokeWidth="1.6" />
                <circle cx="12" cy="25.5" r="1.4" fill="#fff" />
                <circle cx="50" cy="25.5" r="1.4" fill="#fff" />
              </svg>
            </div>
            <div className="tape" />
            <div className="co">
              <b>Zachery&apos;s Moving Co.</b>
              <br />
              <span className="muted">Stockton, CA · {v.business_phone} · zmcmove.com</span>
            </div>
          </div>
          <div className="doc">
            <h1 className="display">Invoice</h1>
            <dl>
              <dt>Invoice</dt>
              <dd>{v.number}</dd>
              <dt>Date</dt>
              <dd>{shortDate(v.issued)}</dd>
              <dt>Status</dt>
              <dd style={{ color: paid ? "#2f7a4f" : "#b5642a" }}>{paid ? "Paid" : "Due"}</dd>
            </dl>
          </div>
        </header>

        <div className="grid2">
          <div className="card">
            <div className="label">Billed to</div>
            <div className="big">{v.customer_name}</div>
            {v.customer_phone && <div className="muted">{v.customer_phone}</div>}
          </div>
          <div className="card">
            <div className="label">Move date</div>
            <div className="big">{`${fmtDayLong(v.move_date)}, ${v.move_date.slice(0, 4)}`}</div>
            <div className="muted">
              {v.start_time ? `Started at ${fmtTime(v.start_time)} · ` : ""}
              {v.job_type}
            </div>
          </div>
        </div>

        <div className="grid2">
          <div className="card">
            <div className="label">Where</div>
            <div className="route">
              <div>
                <div className="dot fill" />
                {v.dropoff_address && <div className="rail" />}
              </div>
              <div className="stop">
                <div className="tag">PICKUP</div>
                <div className="addr">{v.pickup_address || "—"}</div>
                {v.pickup_house && <div className="muted text-[12px]">{v.pickup_house}</div>}
              </div>
              {v.dropoff_address && (
                <>
                  <div>
                    <div className="dot" />
                  </div>
                  <div className="stop" style={{ paddingBottom: 0 }}>
                    <div className="tag">DROP-OFF</div>
                    <div className="addr">{v.dropoff_address}</div>
                    {v.dropoff_house && <div className="muted text-[12px]">{v.dropoff_house}</div>}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="card">
            <div className="label">Your crew</div>
            <div className="big">{crewLine}</div>
            <ul style={{ marginTop: 6 }}>
              <li>
                {v.hours} hours on the job{verified ? `, verified by you on ${verified}` : ""}
              </li>
              {ourTruck && <li>Gas and mileage included</li>}
              <li>Blankets, wrap, dollies, floor and door protection included</li>
            </ul>
          </div>
        </div>

        <section className="price">
          <div className="band">
            <div>
              <div className="display">Your bill</div>
              <div className="sub">
                {flat ? "Flat rate for the whole move" : `Hourly · ${crewLine.replace(" + our", " and our")}${ourTruck ? ", all-inclusive" : ""}`}
              </div>
            </div>
            {!flat && v.detail && (
              <div className="rate">
                <b>{money(v.hourly_rate)}</b>
                <span className="sub"> /hour</span>
              </div>
            )}
          </div>
          <table>
            <tbody>
              {flat ? (
                <tr>
                  <td>
                    Flat rate
                    <small>One price for the whole move, as agreed.</small>
                  </td>
                  <td className="amt">{usd(v.labor)}</td>
                </tr>
              ) : v.detail ? (
                <>
                  <tr>
                    <td>
                      Time on the clock: {v.regular_hours} hours
                      <small>
                        {money(v.hourly_rate)}/hr × {v.regular_hours} hrs{v.hours < v.min_hours + 0.01 ? ` (${v.min_hours}-hour minimum)` : ""}. From when we arrived until the last item was unloaded.
                      </small>
                    </td>
                    <td className="amt">{usd(v.clock_amount)}</td>
                  </tr>
                  {v.ot_hours > 0 && (
                    <tr>
                      <td>
                        Overtime: {v.ot_hours} more hours
                        <small>
                          {money(v.ot_rate)}/hr after {v.overtime_after} hours.
                        </small>
                      </td>
                      <td className="amt">{usd(Math.round(v.ot_rate * v.ot_hours * 100) / 100)}</td>
                    </tr>
                  )}
                  <tr>
                    <td>
                      Travel to and from our shop: about {fmtTravel(v.travel_minutes)}
                      <small>{v.travel_amount ? "Travel time charge." : `No charge for under ${v.travel_free_hours} hours of travel.`}</small>
                    </td>
                    <td className="amt">{usd(v.travel_amount)}</td>
                  </tr>
                </>
              ) : (
                <>
                  <tr>
                    <td>
                      {ourTruck ? "Movers and our truck" : "Labor"}: {v.movers} movers · {v.hours} hrs
                    </td>
                    <td className="amt">{usd(v.labor)}</td>
                  </tr>
                  {v.travel_amount > 0 && (
                    <tr>
                      <td>Travel to and from our shop</td>
                      <td className="amt">{usd(v.travel_amount)}</td>
                    </tr>
                  )}
                  {v.truck_charge > 0 && (
                    <tr>
                      <td>Truck</td>
                      <td className="amt">{usd(v.truck_charge)}</td>
                    </tr>
                  )}
                </>
              )}
              <tr className="total">
                <td>
                  <span className="display">{paid ? "Total paid" : "Total due"}</span>
                </td>
                <td className="amt">{usd(v.total)}</td>
              </tr>
            </tbody>
          </table>
          <div className="nte">
            <div>
              <div className="display">Not-to-exceed price</div>
              <div className="muted" style={{ fontSize: 12 }}>
                From your estimate. Your bill is never more than this.
              </div>
            </div>
            <div className="v">{usd(v.nte)}</div>
          </div>
        </section>

        <div className="grid2">
          <div>
            <h2 className="display">{paid ? "Payment" : "How to pay"}</h2>
            <ul>
              {paid ? (
                <li>
                  Paid {usd(v.total)} by {PAY_LABEL[row.payment_method]} on {tsDate(row.paid_at!)}. Thank you!
                </li>
              ) : (
                payLines(v).map((l) => <li key={l}>{l}</li>)
              )}
            </ul>
          </div>
          <div>
            <h2 className="display">Good to know</h2>
            <ul>
              <li>Questions about this invoice? Call or text {v.business_phone}.</li>
              <li>Moving again or know someone who is? We&apos;d love to help.</li>
            </ul>
          </div>
        </div>

        <div className="cta">
          <div>
            <b>{paid ? "Paid in full" : `Amount due: ${usd(v.total)}`}</b>
            <br />
            <span className="muted">Thank you for choosing Zachery&apos;s Moving Co.</span>
          </div>
          <div className="display" style={{ fontSize: 17, color: "#1f4e8c" }}>
            Thank you!
          </div>
        </div>

        <div className="sigline">
          <div>
            <div className="sigspace">
              {row.signature && (
                // eslint-disable-next-line @next/next/no-img-element -- the signature is a small picture
                <img src={row.signature} alt={`Signature of ${row.signed_name ?? "the customer"}`} />
              )}
            </div>
            <div className="sigrule">
              {row.signed_name ? (
                <>
                  <b>{row.signed_name}</b> · Customer signature
                </>
              ) : (
                "Customer signature"
              )}
            </div>
          </div>
          <div>
            <div className="sigspace">{(row.signed_at || row.hours_verified_at) && <span className="val">{tsDate((row.signed_at || row.hours_verified_at)!)}</span>}</div>
            <div className="sigrule">Date</div>
          </div>
        </div>

        <footer className="foot">
          <span>Invoice for the move on {fmtDayLong(v.move_date)}. Total is within the written not-to-exceed price.</span>
          <span>{v.number} · Page 1 of 1</span>
        </footer>
      </article>

      <div className="no-print mx-auto mt-4 flex max-w-[8.5in] flex-col gap-3 rounded-2xl bg-white p-5 text-center shadow-sm">
        {appLinks.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {appLinks.map(({ m, href }) => (
              <a key={m} href={href} target="_blank" rel="noopener" className="press flex h-12 items-center justify-center rounded-xl bg-[#1f4e8c] text-base font-semibold text-white">
                Pay {usd(v.total)} with {PAY_LABEL[m]}
              </a>
            ))}
          </div>
        )}
        <a
          href={`/i/${token}/pdf`}
          target="_blank"
          rel="noreferrer"
          className={`press inline-flex h-12 items-center justify-center rounded-xl px-6 text-base font-semibold ${appLinks.length ? "border border-[#d5cdbf] text-[#15202b]" : "bg-[#1f4e8c] text-white"}`}
        >
          Save your invoice (PDF)
        </a>
        <p className="text-xs text-[#5b6672]">Saves a one-page copy of this invoice.</p>
      </div>
      <div className="no-print mx-auto mt-4 max-w-[8.5in] rounded-2xl bg-white p-5 shadow-sm">
        <RateMove token={token} initial={rated?.rating ?? null} reviewUrl={rated?.review_url ?? ""} />
      </div>
    </div>
  );
}
