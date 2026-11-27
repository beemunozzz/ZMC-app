// The customer's invoice as a real one-page PDF (server only). Same design as the estimate PDF.
// Built from the customer-safe snapshot, so it can never show our costs.
import { Document, Image, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { payLines, type InvoiceRow } from "./customer-invoice";
import { fmtDayLong, fmtTime } from "./dates";
import { PAY_LABEL } from "./invoices";
import { C, Li, Truck, money0, registerFonts, s, shortDate, travel, usd } from "./quote-pdf";

const tsDate = (ts: string) =>
  new Date(ts).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric" });

function Tr({ title, note, amount }: { title: string; note?: string; amount: number }) {
  return (
    <View style={s.tr}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text>{title}</Text>
        {note ? <Text style={s.small}>{note}</Text> : null}
      </View>
      <Text style={s.amt}>{usd(amount)}</Text>
    </View>
  );
}

function InvoiceDoc({ r }: { r: InvoiceRow }) {
  const v = r.view;
  const paid = !!r.paid_at;
  const flat = v.pricing === "flat";
  const ours = v.truck === "ours";
  const crew = `${v.movers} movers${ours ? " + our 26' box truck" : ""}`;
  const verified = r.hours_verified_at ? tsDate(r.hours_verified_at) : "";
  const signDate = r.signed_at || r.hours_verified_at;
  return (
    <Document title={`Zachery's Moving Co. invoice ${v.number}`} author="Zachery's Moving Co.">
      <Page size="LETTER" style={s.page}>
        <View style={s.head}>
          <View>
            <View style={[s.row, { alignItems: "center" }]}>
              <Text style={s.logo}>ZMC.</Text>
              <View style={{ marginLeft: 9, marginTop: 2 }}>
                <Truck />
              </View>
            </View>
            <View style={s.tape} />
            <Text style={{ fontWeight: 700, fontSize: 10 }}>Zachery&apos;s Moving Co.</Text>
            <Text style={[s.muted, { fontSize: 9 }]}>Stockton, CA · {v.business_phone} · zmcmove.com</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[s.display, { fontSize: 24, color: C.blue }]}>Invoice</Text>
            {(
              [
                ["Invoice", v.number, C.ink],
                ["Date", shortDate(v.issued), C.ink],
                ["Status", paid ? "Paid" : "Due", paid ? "#2F7A4F" : "#B5642A"],
              ] as const
            ).map(([k, val, color]) => (
              <View key={k} style={[s.row, { marginTop: k === "Invoice" ? 6 : 1, fontSize: 9 }]}>
                <Text style={[s.muted, { marginRight: 10 }]}>{k}</Text>
                <Text style={{ fontWeight: 600, width: 72, textAlign: "right", color }}>{val}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[s.row, { marginBottom: 7 }]}>
          <View style={[s.card, { marginRight: 10 }]}>
            <Text style={s.label}>Billed to</Text>
            <Text style={s.big}>{v.customer_name}</Text>
            {v.customer_phone ? <Text style={s.muted}>{v.customer_phone}</Text> : null}
          </View>
          <View style={s.card}>
            <Text style={s.label}>Move date</Text>
            <Text style={s.big}>{`${fmtDayLong(v.move_date)}, ${v.move_date.slice(0, 4)}`}</Text>
            <Text style={s.muted}>
              {v.start_time ? `Started at ${fmtTime(v.start_time)} · ` : ""}
              {v.job_type}
            </Text>
          </View>
        </View>

        <View style={[s.row, { marginBottom: 7 }]}>
          <View style={[s.card, { marginRight: 10 }]}>
            <Text style={s.label}>Where</Text>
            <View style={s.row}>
              <View style={{ width: 14, alignItems: "center" }}>
                <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: C.tape, marginTop: 3 }} />
                {v.dropoff_address ? <View style={{ width: 1.5, height: 22, backgroundColor: C.tape, opacity: 0.6, marginVertical: 2 }} /> : null}
                {v.dropoff_address ? <View style={{ width: 9, height: 9, borderRadius: 4.5, borderWidth: 2, borderColor: C.tape }} /> : null}
              </View>
              <View style={{ flex: 1, marginLeft: 6 }}>
                <Text style={[s.label, { marginBottom: 0 }]}>Pickup</Text>
                <Text style={{ fontWeight: 600, fontSize: 10.5 }}>{v.pickup_address || "—"}</Text>
                {v.pickup_house ? <Text style={[s.muted, { fontSize: 8.5 }]}>{v.pickup_house}</Text> : null}
                {v.dropoff_address ? (
                  <>
                    <Text style={[s.label, { marginBottom: 0, marginTop: 5 }]}>Drop-off</Text>
                    <Text style={{ fontWeight: 600, fontSize: 10.5 }}>{v.dropoff_address}</Text>
                    {v.dropoff_house ? <Text style={[s.muted, { fontSize: 8.5 }]}>{v.dropoff_house}</Text> : null}
                  </>
                ) : null}
              </View>
            </View>
          </View>
          <View style={s.card}>
            <Text style={s.label}>Your crew</Text>
            <Text style={[s.big, { marginBottom: 4 }]}>{crew}</Text>
            <Li>
              {v.hours} hours on the job{verified ? `, verified by you on ${verified}` : ""}
            </Li>
            {ours ? <Li>Gas and mileage included</Li> : null}
            <Li>Blankets, wrap, dollies, floor and door protection included</Li>
          </View>
        </View>

        <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 10, overflow: "hidden", marginBottom: 8 }}>
          <View style={{ backgroundColor: C.navy, paddingVertical: 8, paddingHorizontal: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
            <View>
              <Text style={[s.display, { fontSize: 14, color: "#ffffff", marginBottom: 1 }]}>Your bill</Text>
              <Text style={{ fontSize: 9, color: "#C9D6E8" }}>
                {flat ? "Flat rate for the whole move" : `Hourly · ${crew.replace(" + our", " and our")}${ours ? ", all-inclusive" : ""}`}
              </Text>
            </View>
            {!flat && v.detail ? (
              <View style={[s.row, { alignItems: "flex-end" }]}>
                <Text style={[s.display, { fontSize: 24, color: C.tape }]}>{money0(v.hourly_rate)}</Text>
                <Text style={{ fontSize: 9, color: "#C9D6E8", marginLeft: 2, marginBottom: 2 }}>/hour</Text>
              </View>
            ) : null}
          </View>
          {flat ? (
            <Tr title="Flat rate" note="One price for the whole move, as agreed." amount={v.labor} />
          ) : v.detail ? (
            <>
              <Tr
                title={`Time on the clock: ${v.regular_hours} hours`}
                note={`${money0(v.hourly_rate)}/hr × ${v.regular_hours} hrs${v.hours < v.min_hours + 0.01 ? ` (${v.min_hours}-hour minimum)` : ""}. From when we arrived until the last item was unloaded.`}
                amount={v.clock_amount}
              />
              {v.ot_hours > 0 ? (
                <Tr title={`Overtime: ${v.ot_hours} more hours`} note={`${money0(v.ot_rate)}/hr after ${v.overtime_after} hours.`} amount={Math.round(v.ot_rate * v.ot_hours * 100) / 100} />
              ) : null}
              <Tr
                title={`Travel to and from our shop: about ${travel(v.travel_minutes)}`}
                note={v.travel_amount ? "Travel time charge." : `No charge for under ${v.travel_free_hours} hours of travel.`}
                amount={v.travel_amount}
              />
            </>
          ) : (
            <>
              <Tr title={`${ours ? "Movers and our truck" : "Labor"}: ${v.movers} movers · ${v.hours} hrs`} amount={v.labor} />
              {v.travel_amount > 0 ? <Tr title="Travel to and from our shop" amount={v.travel_amount} /> : null}
              {v.truck_charge > 0 ? <Tr title="Truck" amount={v.truck_charge} /> : null}
            </>
          )}
          <View style={[s.tr, { backgroundColor: C.paper, borderBottomWidth: 0, alignItems: "center", paddingVertical: 6 }]}>
            <Text style={[s.display, { fontSize: 14 }]}>{paid ? "Total paid" : "Total due"}</Text>
            <Text style={[s.display, { fontSize: 19 }]}>{usd(v.total)}</Text>
          </View>
          <View style={{ backgroundColor: C.pale, borderTopWidth: 1, borderTopColor: C.paleLine, paddingVertical: 6, paddingHorizontal: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[s.display, { fontSize: 13, color: C.blue }]}>Not-to-exceed price</Text>
              <Text style={[s.muted, { fontSize: 8.5 }]}>From your estimate. Your bill is never more than this.</Text>
            </View>
            <Text style={[s.display, { fontSize: 19, color: C.blue }]}>{usd(v.nte)}</Text>
          </View>
        </View>

        <View style={[s.row, { marginBottom: 8 }]}>
          <View style={{ flex: 1, marginRight: 14 }}>
            <Text style={[s.display, { fontSize: 12, marginBottom: 4 }]}>{paid ? "Payment" : "How to pay"}</Text>
            {paid ? (
              <Li>
                Paid {usd(v.total)} by {PAY_LABEL[r.payment_method]} on {tsDate(r.paid_at!)}. Thank you!
              </Li>
            ) : (
              payLines(v).map((l) => <Li key={l}>{l}</Li>)
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.display, { fontSize: 12, marginBottom: 4 }]}>Good to know</Text>
            <Li>Questions about this invoice? Call or text {v.business_phone}.</Li>
            <Li>Moving again or know someone who is? We&apos;d love to help.</Li>
          </View>
        </View>

        <View style={{ backgroundColor: C.paper, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ fontWeight: 700, fontSize: 11 }}>{paid ? "Paid in full" : `Amount due: ${usd(v.total)}`}</Text>
            <Text style={s.muted}>Thank you for choosing Zachery&apos;s Moving Co.</Text>
          </View>
          <Text style={[s.display, { fontSize: 13, color: C.blue }]}>Thank you!</Text>
        </View>

        <View style={s.row}>
          <View style={{ flex: 2, marginRight: 18 }}>
            <View style={{ height: 30, justifyContent: "flex-end" }}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- PDF image */}
              {r.signature ? <Image src={r.signature} style={{ height: 28, width: 140, objectFit: "contain", objectPosition: "left bottom" }} /> : null}
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: C.ink, paddingTop: 3 }}>
              <Text style={[s.muted, { fontSize: 8 }]}>
                {r.signed_name ? <Text style={{ color: C.ink, fontWeight: 600 }}>{r.signed_name} · </Text> : null}
                Customer signature
              </Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ height: 30, justifyContent: "flex-end", paddingBottom: 2 }}>
              {signDate ? <Text style={{ fontWeight: 600, fontSize: 10.5 }}>{tsDate(signDate)}</Text> : null}
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: C.ink, paddingTop: 3 }}>
              <Text style={[s.muted, { fontSize: 8 }]}>Date</Text>
            </View>
          </View>
        </View>

        <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 5, flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={[s.muted, { fontSize: 7.5, flex: 1, paddingRight: 12 }]}>
            Invoice for the move on {fmtDayLong(v.move_date)}. Total is within the written not-to-exceed price.
          </Text>
          <Text style={[s.muted, { fontSize: 7.5 }]}>{v.number} · Page 1 of 1</Text>
        </View>
      </Page>
    </Document>
  );
}

/** The invoice as PDF bytes. */
export async function renderInvoicePdf(r: InvoiceRow) {
  registerFonts();
  return renderToBuffer(<InvoiceDoc r={r} />);
}
