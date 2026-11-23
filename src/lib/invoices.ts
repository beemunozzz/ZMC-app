// Invoices: types, payment methods and payment links. Safe to use on the server and the phone.
import { fmtDayLong } from "./dates";
import { money, type Prices } from "./pricing";

export type PayMethod = "cash" | "check" | "zelle" | "card" | "apple_pay" | "cashapp" | "venmo";

export const PAY_METHODS: { key: PayMethod; label: string }[] = [
  { key: "cash", label: "Cash" },
  { key: "check", label: "Check" },
  { key: "zelle", label: "Zelle" },
  { key: "card", label: "Card" },
  { key: "apple_pay", label: "Apple Pay" },
  { key: "cashapp", label: "Cash App" },
  { key: "venmo", label: "Venmo" },
];
export const PAY_LABEL = Object.fromEntries(PAY_METHODS.map((m) => [m.key, m.label])) as Record<PayMethod, string>;

export type Invoice = {
  id: string;
  job_id: string;
  customer_name: string;
  customer_phone: string;
  hours: number;
  movers: number;
  truck: "ours" | "theirs";
  miles_out: number | null;
  miles_between: number | null;
  miles_back: number | null;
  labor: number;
  trip: number;
  truck_charge: number;
  total: number;
  nte: number;
  /** Optional: the customer may choose not to sign. */
  signature: string | null;
  signed_name: string | null;
  signed_at: string | null;
  /** When the customer tapped "I verify these hours", and what they verified (never changes). */
  hours_verified_at: string | null;
  verified_hours: number | null;
  verified_movers: number | null;
  /** Set when the owner changed the hours afterwards. */
  owner_edited_at: string | null;
  payment_method: PayMethod;
  paid_at: string | null;
  created_at: string;
};

export const INVOICE_COLUMNS =
  "id, job_id, customer_name, customer_phone, hours, movers, truck, miles_out, miles_between, miles_back, labor, trip, truck_charge, total, nte, signature, signed_name, signed_at, hours_verified_at, verified_hours, verified_movers, owner_edited_at, payment_method, paid_at, created_at";

const amount = (n: number) => (Math.round(n * 100) / 100).toString();

/** Payment link with the amount filled in (Cash App, Venmo), or null when there's no link for that method. */
export function payLink(method: PayMethod, total: number, s: Prices, note: string) {
  if (method === "cashapp" && s.cashapp) {
    const tag = s.cashapp.replace(/^\$/, "").trim();
    return `https://cash.app/$${encodeURIComponent(tag)}/${amount(total)}`;
  }
  if (method === "venmo" && s.venmo) {
    const user = s.venmo.replace(/^@/, "").trim();
    return `https://venmo.com/?txn=pay&recipients=${encodeURIComponent(user)}&amount=${amount(total)}&note=${encodeURIComponent(note)}`;
  }
  return null;
}

/** Short receipt the crew can text the customer. */
export function receiptText(inv: Pick<Invoice, "customer_name" | "total" | "hours" | "movers" | "payment_method" | "paid_at">, jobDate: string, s: Prices) {
  const first = inv.customer_name.trim().split(/\s+/)[0] || "there";
  return (
    `Hi ${first}, thank you for choosing Zachery's Moving Co.! ` +
    `Your total for your move on ${fmtDayLong(jobDate)} is ${money(Number(inv.total))} ` +
    `(${inv.movers} movers, ${Number(inv.hours)} hrs). ` +
    (inv.paid_at ? `Paid by ${PAY_LABEL[inv.payment_method]}. ` : `Payment: ${PAY_LABEL[inv.payment_method]}. `) +
    `Questions? Call or text ${s.business_phone}.`
  );
}
