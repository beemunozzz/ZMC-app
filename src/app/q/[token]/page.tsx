import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { CustomerView } from "@/lib/customer-quote";
import { fmtDayLong, fmtTime, todayISO } from "@/lib/dates";
import { money } from "@/lib/pricing";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { AcceptForm, SaveButton } from "./AcceptForm";
import "./quote-doc.css";

export const metadata: Metadata = { title: "Your moving estimate · Zachery's Moving Co.", robots: { index: false, follow: false } };

type Row = { view: CustomerView; valid_until: string | null; accepted_at: string | null; signed_name: string | null; signature: string | null; status: string };

export default function CustomerQuotePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<div className="qwrap" />}>
      <CustomerQuote params={params} />
    </Suspense>
  );
}

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const shortDate = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
const fmtTravel = (m: number) => (m < 60 ? `${m} minutes` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`);

async function CustomerQuote({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  if (!/^[0-9a-f]{40,80}$/.test(token)) notFound();
  const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const { data } = await db.rpc("public_quote", { p_token: token });
  const row = ((data ?? []) as Row[])[0];
  if (!row?.view) notFound();
  const v = row.view;
  const today = todayISO();
  const accepted = !!row.accepted_at;
  const expired = !accepted && !!row.valid_until && today > row.valid_until;
  const pastDate = !accepted && (!v.move_date || v.move_date < today);
  const closed = !accepted && row.status === "declined";
  const flat = v.pricing === "flat" && v.flat_price != null;
  const ourTruck = v.truck === "ours";
  const crewLine = `${v.movers} movers${ourTruck ? " + our 26' box truck" : ""}`;
  const signedDate = row.accepted_at
    ? new Date(row.accepted_at).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric" })
    : "";

  return (
    <div className="qwrap">
      {/* Top bar (not printed) */}
      <div className="no-print mx-auto mb-3 flex max-w-[8.5in] items-center justify-between gap-3 px-1">
        <p className="text-sm font-medium text-[#3a4652]">
          {accepted ? "✓ Signed and booked" : expired ? "This estimate has expired" : "Your moving estimate"}
        </p>
        {accepted && <SaveButton />}
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
            <h1 className="display">Moving estimate</h1>
            <dl>
              <dt>Quote</dt>
              <dd>{v.number}</dd>
              <dt>Date</dt>
              <dd>{shortDate(v.issued)}</dd>
              <dt>Good through</dt>
              <dd>{shortDate(v.valid_until)}</dd>
            </dl>
          </div>
        </header>

        <div className="grid2">
          <div className="card">
            <div className="label">Prepared for</div>
            <div className="big">{v.customer_name}</div>
            {v.customer_phone && <div className="muted">{v.customer_phone}</div>}
          </div>
          <div className="card">
            <div className="label">Move date</div>
            <div className="big">{v.move_date ? fmtDayLong(v.move_date) + ", " + v.move_date.slice(0, 4) : "To be confirmed"}</div>
            <div className="muted">
              {v.start_time ? `Crew arrives at ${fmtTime(v.start_time)}` : "Arrival time to be confirmed"} · {v.job_type}
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
                <div className="addr">{v.pickup_address || "To be confirmed"}</div>
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
              {ourTruck && <li>Gas and mileage included</li>}
              <li>Blankets, plastic wrap, dollies and straps</li>
              <li>Floor runners and door-jamb protection</li>
            </ul>
          </div>
        </div>

        <section className="price">
          <div className="band">
            <div>
              <div className="display">Your price</div>
              <div className="sub">{flat ? "Flat rate for the whole move" : `Hourly · ${crewLine.replace(" + our", " and our")}${ourTruck ? ", all-inclusive" : ""}`}</div>
            </div>
            {!flat && (
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
                    <small>One price for the whole move, as described above.</small>
                  </td>
                  <td className="amt">{usd(v.flat_price!)}</td>
                </tr>
              ) : (
                <>
                  <tr>
                    <td>
                      Estimated time on the clock: about {v.regular_hours} hours
                      <small>
                        {money(v.hourly_rate)}/hr × {v.regular_hours} hrs. The clock starts when we arrive and stops when the last item is unloaded.
                      </small>
                    </td>
                    <td className="amt">{usd(v.clock_amount)}</td>
                  </tr>
                  {v.ot_hours > 0 && (
                    <tr>
                      <td>
                        Overtime: about {v.ot_hours} more hours
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
              )}
              <tr className="total">
                <td>
                  <span className="display">{flat ? "Total" : "Estimated total"}</span>
                </td>
                <td className="amt">{usd(v.total)}</td>
              </tr>
            </tbody>
          </table>
          <div className="nte">
            <div>
              <div className="display">Not-to-exceed price</div>
              <div className="muted" style={{ fontSize: 12 }}>
                Your final bill will never be more than this, even if the move takes longer.
              </div>
            </div>
            <div className="v">{usd(v.nte)}</div>
          </div>
        </section>

        <div className="grid2">
          <div>
            <h2 className="display">How billing works</h2>
            <ul>
              {flat ? (
                <li>One flat price for the move described above. It can change only if the move changes.</li>
              ) : (
                <>
                  <li>You pay for the time we actually work, up to the not-to-exceed price.</li>
                  <li>{v.min_hours}-hour minimum. Time is billed in 15-minute steps.</li>
                  <li>The drive between your two addresses is on the clock.</li>
                  <li>
                    After {v.overtime_after} hours, each extra hour is {money(v.ot_rate)} (crew overtime).
                  </li>
                </>
              )}
              <li>Paid when the job is done: cash, check, Zelle, card, Apple Pay, Cash App or Venmo.</li>
            </ul>
          </div>
          <div>
            <h2 className="display">Good to know</h2>
            <ul>
              <li>
                {v.start_time ? `Your crew arrives at ${fmtTime(v.start_time)}. ` : ""}We&apos;ll text you the day before and when we&apos;re on our way.
              </li>
              <li>Please have boxes packed and taped before we arrive.</li>
              <li className="no">We don&apos;t move pianos or hot tubs. We&apos;re happy to recommend a specialist.</li>
              <li>Changes to the date or the size of the move can change the estimate.</li>
            </ul>
          </div>
        </div>

        <div className="cta">
          <div>
            <b>{accepted ? "You're booked!" : "Ready to book?"}</b>
            <br />
            <span className="muted">
              {accepted ? `We'll see you on ${v.move_date ? fmtDayLong(v.move_date) : "moving day"}. Questions? Call or text ${v.business_phone}.` : `Sign below to book, or call or text ${v.business_phone}.`}
            </span>
          </div>
          <div className="display" style={{ fontSize: 17, color: "#1f4e8c" }}>
            Thank you!
          </div>
        </div>

        {/* Signature lines (saved PDF only). Fixed height, so a signed copy is exactly as tall as an unsigned one. */}
        <div className="sigline print-only">
          <div>
            <div className="sigspace">
              {accepted && row.signature && (
                // eslint-disable-next-line @next/next/no-img-element -- the signature is a small picture
                <img src={row.signature} alt={`Signature of ${row.signed_name ?? "the customer"}`} />
              )}
            </div>
            <div className="sigrule">
              {accepted && row.signed_name ? <b>{row.signed_name}</b> : null}
              {accepted && row.signed_name ? " · " : ""}Customer signature (accepts this estimate and not-to-exceed price)
            </div>
          </div>
          <div>
            <div className="sigspace">{accepted && <span className="val">{signedDate}</span>}</div>
            <div className="sigrule">Date</div>
          </div>
        </div>

        <footer className="foot">
          <span>
            {flat
              ? "Flat-rate estimate for the move described above."
              : "Estimate for an hourly move. Your final charge is based on the actual time worked and will not exceed the not-to-exceed price above."}
          </span>
          <span>{v.number} · Page 1 of 1</span>
        </footer>
      </article>

      {/* Sign and book (not printed) */}
      <div className="no-print mx-auto mt-4 max-w-[8.5in]">
        {accepted ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 text-center shadow-sm">
            <p className="text-2xl font-bold text-[#2f7a4f]">✓ Thank you, you&apos;re booked!</p>
            <p className="text-[15px] text-[#3a4652]">
              Your move is booked for <b>{v.move_date ? `${fmtDayLong(v.move_date)}, ${v.move_date.slice(0, 4)}` : "your moving day"}</b>
              {v.start_time ? (
                <>
                  {" "}
                  at <b>{fmtTime(v.start_time)}</b>
                </>
              ) : null}
              . Signed by {row.signed_name} on {signedDate}. We&apos;ll text you the day before.
            </p>
            <div className="flex justify-center">
              <SaveButton big />
            </div>
            <p className="text-xs text-[#5b6672]">Saves a one-page copy of your signed estimate.</p>
          </div>
        ) : closed || expired || pastDate ? (
          <p className="rounded-xl bg-white p-4 text-[15px] text-[#15202b] shadow-sm">
            {closed
              ? "This estimate is no longer open."
              : expired
                ? "This estimate has expired."
                : "This move date has passed."}{" "}
            Please call or text <a className="font-semibold text-[#1f4e8c]" href={`tel:${v.business_phone.replace(/\D/g, "")}`}>{v.business_phone}</a> and we&apos;ll get you an updated estimate.
          </p>
        ) : (
          <AcceptForm token={token} defaultName={v.customer_name} nte={usd(v.nte)} />
        )}
      </div>
    </div>
  );
}
