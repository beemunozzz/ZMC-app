// The customer's estimate as a real one-page PDF (server only). Same design as the approved estimate.
// Built from the customer-safe snapshot (CustomerView), so it can never show our costs.
import path from "node:path";
import { Circle, Document, Font, Image, Page, Path, Rect, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { CustomerView } from "./customer-quote";
import { fmtDayLong, fmtTime } from "./dates";

const fonts = path.join(process.cwd(), "src/assets/fonts");
let registered = false;
export function registerFonts() {
  if (registered) return;
  Font.register({
    family: "Archivo",
    fonts: [400, 500, 600, 700].map((w) => ({ src: path.join(fonts, `archivo-latin-${w}-normal.woff`), fontWeight: w })),
  });
  Font.register({ family: "Narrow", src: path.join(fonts, "archivo-narrow-latin-700-normal.woff"), fontWeight: 700 });
  Font.register({ family: "Logo", src: path.join(fonts, "gelasio-latin-700-normal.woff"), fontWeight: 700 });
  Font.registerHyphenationCallback((w) => [w]); // never break words with hyphens
  registered = true;
}

export const C = { ink: "#15202B", muted: "#5B6672", line: "#E2DBD0", paper: "#F3F0EA", blue: "#1F4E8C", tape: "#D9A25B", navy: "#142B4A", pale: "#EAF1FA", paleLine: "#C9D6E8" };

export const s = StyleSheet.create({
  page: { fontFamily: "Archivo", fontSize: 9.5, color: C.ink, paddingTop: 24, paddingBottom: 18, paddingHorizontal: 40, lineHeight: 1.3 },
  display: { fontFamily: "Narrow", fontWeight: 700, textTransform: "uppercase", lineHeight: 1.15 },
  muted: { color: C.muted },
  row: { flexDirection: "row" },
  head: { flexDirection: "row", justifyContent: "space-between", paddingBottom: 7, borderBottomWidth: 3, borderBottomColor: C.ink, marginBottom: 7 },
  logo: { fontFamily: "Logo", fontWeight: 700, fontSize: 30, letterSpacing: 1.2, lineHeight: 1 },
  tape: { width: 44, height: 4, borderRadius: 2, backgroundColor: C.tape, marginTop: 6, marginBottom: 6 },
  card: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  label: { fontSize: 7.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: C.muted, marginBottom: 3 },
  big: { fontSize: 12, fontWeight: 700 },
  li: { flexDirection: "row", marginBottom: 1 },
  bullet: { width: 4.5, height: 4.5, borderRadius: 2.25, backgroundColor: C.tape, marginTop: 4, marginRight: 6 },
  ring: { width: 4.5, height: 4.5, borderRadius: 2.25, borderWidth: 1, borderColor: C.muted, marginTop: 4, marginRight: 6 },
  tr: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3.5, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  amt: { fontWeight: 600 },
  small: { fontSize: 8, color: C.muted, marginTop: 1 },
});

export const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
export const money0 = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: n % 1 ? 2 : 0 });
export const shortDate = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
/** House details on one line in the PDF's half-width "Where" card (cut at a "·" with "…" when too long). */
export function oneLine(s: string, max = 64) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" · "), 20)) + " …";
}
export const travel = (m: number) => (m < 60 ? `${m} minutes` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`);

export function Li({ children, no }: { children: React.ReactNode; no?: boolean }) {
  return (
    <View style={s.li} wrap={false}>
      <View style={no ? s.ring : s.bullet} />
      <Text style={{ flex: 1, fontSize: 8.7 }}>{children}</Text>
    </View>
  );
}

export function Truck() {
  return (
    <Svg width={44} height={22} viewBox="0 0 64 32">
      <Path fill={C.ink} d="M2 5.5A1.5 1.5 0 0 1 3.5 4h35A1.5 1.5 0 0 1 40 5.5V24H2z" />
      <Path fill={C.ink} d="M41.5 10h9.2c.5 0 1 .2 1.3.6l6.2 6.6c.3.3.4.7.4 1.1V24H41.5z" />
      <Path fill={C.paper} d="M44 12.2h6.1l4.6 4.9H44z" />
      <Rect x={2} y={20.4} width={38} height={1.4} fill={C.tape} />
      <Circle cx={12} cy={25.5} r={4.6} fill={C.ink} stroke="#ffffff" strokeWidth={1.6} />
      <Circle cx={50} cy={25.5} r={4.6} fill={C.ink} stroke="#ffffff" strokeWidth={1.6} />
      <Circle cx={12} cy={25.5} r={1.4} fill="#ffffff" />
      <Circle cx={50} cy={25.5} r={1.4} fill="#ffffff" />
    </Svg>
  );
}

export type SignedInfo = { name: string | null; signature: string | null; date: string } | null;

function Estimate({ v, signed }: { v: CustomerView; signed: SignedInfo }) {
  const flat = v.pricing === "flat" && v.flat_price != null;
  const ours = v.truck === "ours";
  const crew = `${v.movers} movers${ours ? " + our 26' box truck" : ""}`;
  return (
    <Document title={`Zachery's Moving Co. estimate ${v.number}`} author="Zachery's Moving Co.">
      <Page size="LETTER" style={s.page}>
        {/* Header */}
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
            <Text style={[s.display, { fontSize: 24, color: C.blue }]}>Moving estimate</Text>
            {(
              [
                ["Quote", v.number],
                ["Date", shortDate(v.issued)],
                ["Good through", shortDate(v.valid_until)],
              ] as const
            ).map(([k, val]) => (
              <View key={k} style={[s.row, { marginTop: k === "Quote" ? 6 : 1, fontSize: 9 }]}>
                <Text style={[s.muted, { marginRight: 10 }]}>{k}</Text>
                <Text style={{ fontWeight: 600, width: 72, textAlign: "right" }}>{val}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Who and when */}
        <View style={[s.row, { marginBottom: 7 }]}>
          <View style={[s.card, { marginRight: 10 }]}>
            <Text style={s.label}>Prepared for</Text>
            <Text style={s.big}>{v.customer_name}</Text>
            {v.customer_phone ? <Text style={s.muted}>{v.customer_phone}</Text> : null}
          </View>
          <View style={s.card}>
            <Text style={s.label}>Move date</Text>
            <Text style={s.big}>{v.move_date ? `${fmtDayLong(v.move_date)}, ${v.move_date.slice(0, 4)}` : "To be confirmed"}</Text>
            <Text style={s.muted}>
              {v.start_time ? `Crew arrives at ${fmtTime(v.start_time)}` : "Arrival time to be confirmed"} · {v.job_type}
            </Text>
          </View>
        </View>

        {/* Where and crew */}
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
                <Text style={{ fontWeight: 600, fontSize: 10.5 }}>{v.pickup_address || "To be confirmed"}</Text>
                {v.pickup_house ? <Text style={[s.muted, { fontSize: 8 }]}>{oneLine(v.pickup_house)}</Text> : null}
                {v.dropoff_address ? (
                  <>
                    <Text style={[s.label, { marginBottom: 0, marginTop: 5 }]}>Drop-off</Text>
                    <Text style={{ fontWeight: 600, fontSize: 10.5 }}>{v.dropoff_address}</Text>
                    {v.dropoff_house ? <Text style={[s.muted, { fontSize: 8 }]}>{oneLine(v.dropoff_house)}</Text> : null}
                  </>
                ) : null}
              </View>
            </View>
          </View>
          <View style={s.card}>
            <Text style={s.label}>Your crew</Text>
            <Text style={[s.big, { marginBottom: 4 }]}>{crew}</Text>
            {ours ? <Li>Gas and mileage included</Li> : null}
            <Li>Blankets, plastic wrap, dollies and straps</Li>
            <Li>Floor runners and door-jamb protection</Li>
          </View>
        </View>

        {/* Price */}
        <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 10, overflow: "hidden", marginBottom: 8 }}>
          <View style={{ backgroundColor: C.navy, paddingVertical: 8, paddingHorizontal: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
            <View>
              <Text style={[s.display, { fontSize: 14, color: "#ffffff", marginBottom: 1 }]}>Your price</Text>
              <Text style={{ fontSize: 9, color: "#C9D6E8" }}>
                {flat ? "Flat rate for the whole move" : `Hourly · ${crew.replace(" + our", " and our")}${ours ? ", all-inclusive" : ""}`}
              </Text>
            </View>
            {!flat ? (
              <View style={[s.row, { alignItems: "flex-end" }]}>
                <Text style={[s.display, { fontSize: 24, color: C.tape }]}>{money0(v.hourly_rate)}</Text>
                <Text style={{ fontSize: 9, color: "#C9D6E8", marginLeft: 2, marginBottom: 2 }}>/hour</Text>
              </View>
            ) : null}
          </View>
          {flat ? (
            <View style={s.tr}>
              <View style={{ flex: 1 }}>
                <Text>Flat rate</Text>
                <Text style={s.small}>One price for the whole move, as described above.</Text>
              </View>
              <Text style={s.amt}>{usd(v.flat_price!)}</Text>
            </View>
          ) : (
            <>
              <View style={s.tr}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text>Estimated time on the clock: about {v.regular_hours} hours</Text>
                  <Text style={s.small}>
                    {money0(v.hourly_rate)}/hr × {v.regular_hours} hrs. The clock starts when we arrive and stops when the last item is unloaded.
                  </Text>
                </View>
                <Text style={s.amt}>{usd(v.clock_amount)}</Text>
              </View>
              {v.ot_hours > 0 ? (
                <View style={s.tr}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text>Overtime: about {v.ot_hours} more hours</Text>
                    <Text style={s.small}>
                      {money0(v.ot_rate)}/hr after {v.overtime_after} hours.
                    </Text>
                  </View>
                  <Text style={s.amt}>{usd(Math.round(v.ot_rate * v.ot_hours * 100) / 100)}</Text>
                </View>
              ) : null}
              <View style={s.tr}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text>Travel to and from our shop: about {travel(v.travel_minutes)}</Text>
                  <Text style={s.small}>{v.travel_amount ? "Travel time charge." : `No charge for under ${v.travel_free_hours} hours of travel.`}</Text>
                </View>
                <Text style={s.amt}>{usd(v.travel_amount)}</Text>
              </View>
            </>
          )}
          <View style={[s.tr, { backgroundColor: C.paper, borderBottomWidth: 0, alignItems: "center", paddingVertical: 6 }]}>
            <Text style={[s.display, { fontSize: 14 }]}>{flat ? "Total" : "Estimated total"}</Text>
            <Text style={[s.display, { fontSize: 19 }]}>{usd(v.total)}</Text>
          </View>
          <View style={{ backgroundColor: C.pale, borderTopWidth: 1, borderTopColor: C.paleLine, paddingVertical: 6, paddingHorizontal: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[s.display, { fontSize: 13, color: C.blue }]}>Not-to-exceed price</Text>
              <Text style={[s.muted, { fontSize: 8.5 }]}>Your final bill will never be more than this, even if the move takes longer.</Text>
            </View>
            <Text style={[s.display, { fontSize: 19, color: C.blue }]}>{usd(v.nte)}</Text>
          </View>
        </View>

        {/* Billing and good to know */}
        <View style={[s.row, { marginBottom: 8 }]}>
          <View style={{ flex: 1, marginRight: 14 }}>
            <Text style={[s.display, { fontSize: 12, marginBottom: 4 }]}>How billing works</Text>
            {flat ? (
              <Li>One flat price for the move described above. It can change only if the move changes.</Li>
            ) : (
              <>
                <Li>You pay for the time we actually work, up to the not-to-exceed price.</Li>
                <Li>{v.min_hours}-hour minimum. Time is billed in 15-minute steps.</Li>
                <Li>The drive between your two addresses is on the clock.</Li>
                <Li>
                  After {v.overtime_after} hours, each extra hour is {money0(v.ot_rate)} (crew overtime).
                </Li>
              </>
            )}
            <Li>Paid when the job is done: cash, check, Zelle, card, Apple Pay, Cash App or Venmo.</Li>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.display, { fontSize: 12, marginBottom: 4 }]}>Good to know</Text>
            <Li>{v.start_time ? `Your crew arrives at ${fmtTime(v.start_time)}. ` : ""}We&apos;ll text you the day before and when we&apos;re on our way.</Li>
            <Li>Please have boxes packed and taped before we arrive.</Li>
            <Li no>We don&apos;t move pianos or hot tubs. We&apos;re happy to recommend a specialist.</Li>
            <Li>{v.cancellation_policy || "Changes to the date or the size of the move can change the estimate."}</Li>
          </View>
        </View>

        {/* Book */}
        <View style={{ backgroundColor: C.paper, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ fontWeight: 700, fontSize: 11 }}>{signed ? "You're booked!" : "Ready to book?"}</Text>
            <Text style={s.muted}>
              {signed
                ? `We'll see you on ${v.move_date ? fmtDayLong(v.move_date) : "moving day"}. Questions? Call or text ${v.business_phone}.`
                : `Sign below to book, or call or text ${v.business_phone}.`}
            </Text>
          </View>
          <Text style={[s.display, { fontSize: 13, color: C.blue }]}>Thank you!</Text>
        </View>

        {/* Signature lines */}
        <View style={s.row}>
          <View style={{ flex: 2, marginRight: 18 }}>
            <View style={{ height: 30, justifyContent: "flex-end" }}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- PDF image */}
              {signed?.signature ? <Image src={signed.signature} style={{ height: 28, width: 140, objectFit: "contain", objectPosition: "left bottom" }} /> : null}
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: C.ink, paddingTop: 3 }}>
              <Text style={[s.muted, { fontSize: 8 }]}>
                {signed?.name ? <Text style={{ color: C.ink, fontWeight: 600 }}>{signed.name} · </Text> : null}
                Customer signature{signed?.name ? "" : " (accepts this estimate and not-to-exceed price)"}
              </Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ height: 30, justifyContent: "flex-end", paddingBottom: 2 }}>
              {signed ? <Text style={{ fontWeight: 600, fontSize: 10.5 }}>{signed.date}</Text> : null}
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: C.ink, paddingTop: 3 }}>
              <Text style={[s.muted, { fontSize: 8 }]}>Date</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 5, flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={[s.muted, { fontSize: 7.5, flex: 1, paddingRight: 12 }]}>
            {flat
              ? "Flat-rate estimate for the move described above."
              : "Estimate for an hourly move. Your final charge is based on the actual time worked and will not exceed the not-to-exceed price above."}
          </Text>
          <Text style={[s.muted, { fontSize: 7.5 }]}>{v.number} · Page 1 of 1</Text>
        </View>
      </Page>
    </Document>
  );
}

/** The estimate as PDF bytes. */
export async function renderQuotePdf(v: CustomerView, signed: SignedInfo) {
  registerFonts();
  return renderToBuffer(<Estimate v={v} signed={signed} />);
}
