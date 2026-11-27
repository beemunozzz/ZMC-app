// Customers: built from quotes, jobs and invoices, matched by phone number (or by name when there's no phone).
// Owner only (quotes and invoices are owner-only tables). Safe on the server and the phone.

export type CQuote = {
  id: string;
  customer_name: string;
  customer_phone: string;
  email?: string;
  status: string;
  created_at: string;
  move_date: string | null;
  quote_total: number | null;
  heard_from: string;
  referred_by?: string;
  partner_id?: string | null;
  lost_reason?: string;
  pickup_address: string;
  dropoff_address: string;
  job_id: string | null;
};
export type CJob = { id: string; customer_name: string; customer_phone: string; job_date: string; status: string; job_type: string; pickup_address: string; dropoff_address: string };
export type CInvoice = { id: string; job_id: string; customer_name: string; customer_phone: string; total: number; paid_at: string | null; created_at: string; rating?: number | null };

export type Customer = {
  key: string;
  name: string;
  phone: string;
  email: string;
  heardFrom: string;
  referredBy: string;
  partnerId: string | null;
  quotes: CQuote[];
  jobs: CJob[];
  invoices: CInvoice[];
  spent: number; // paid invoices
  billed: number; // all invoices
  lastDate: string; // latest move, job or quote date
  repeat: boolean; // 2+ jobs
  rating: number | null; // average of their ratings
};

/** "2095550188" from "(209) 555-0188"; the last 10 digits so +1 and spaces don't matter. */
export const phoneKey = (p: string) => (p ?? "").replace(/\D/g, "").slice(-10);
const nameKey = (n: string) => "n-" + n.replace(/^example:\s*/i, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
export const customerKey = (name: string, phone: string) => (phoneKey(phone).length >= 7 ? phoneKey(phone) : nameKey(name));

export function buildCustomers(quotes: CQuote[], jobs: CJob[], invoices: CInvoice[]): Customer[] {
  const map = new Map<string, Customer>();
  const get = (name: string, phone: string) => {
    const key = customerKey(name, phone);
    let c = map.get(key);
    if (!c) {
      c = { key, name, phone, email: "", heardFrom: "", referredBy: "", partnerId: null, quotes: [], jobs: [], invoices: [], spent: 0, billed: 0, lastDate: "", repeat: false, rating: null };
      map.set(key, c);
    }
    if (!c.phone && phone) c.phone = phone;
    return c;
  };
  // Oldest first, so "how they heard about us" is from their first contact and the name is the latest.
  for (const q of [...quotes].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const c = get(q.customer_name, q.customer_phone);
    c.name = q.customer_name;
    c.quotes.push(q);
    if (!c.heardFrom && q.heard_from) c.heardFrom = q.heard_from;
    if (!c.referredBy && q.referred_by) c.referredBy = q.referred_by;
    if (!c.partnerId && q.partner_id) c.partnerId = q.partner_id;
    if (!c.email && q.email) c.email = q.email;
  }
  for (const j of jobs) get(j.customer_name, j.customer_phone).jobs.push(j);
  for (const i of invoices) {
    const c = get(i.customer_name, i.customer_phone);
    c.invoices.push(i);
    c.billed += Number(i.total) || 0;
    if (i.paid_at) c.spent += Number(i.total) || 0;
  }
  for (const c of map.values()) {
    const live = c.jobs.filter((j) => j.status !== "canceled");
    c.repeat = live.length >= 2;
    const dates = [...c.jobs.map((j) => j.job_date), ...c.quotes.map((q) => q.move_date ?? q.created_at.slice(0, 10))];
    c.lastDate = dates.sort().at(-1) ?? "";
    const ratings = c.invoices.map((i) => i.rating).filter((r): r is number => !!r);
    c.rating = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null;
    c.quotes.sort((a, b) => b.created_at.localeCompare(a.created_at));
    c.jobs.sort((a, b) => b.job_date.localeCompare(a.job_date));
    c.invoices.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  return [...map.values()].sort((a, b) => b.lastDate.localeCompare(a.lastDate));
}

export const CUSTOMER_QUOTE_COLUMNS =
  "id, customer_name, customer_phone, email, status, created_at, move_date, quote_total, heard_from, referred_by, partner_id, lost_reason, pickup_address, dropoff_address, job_id";
export const CUSTOMER_JOB_COLUMNS = "id, customer_name, customer_phone, job_date, status, job_type, pickup_address, dropoff_address";
export const CUSTOMER_INVOICE_COLUMNS = "id, job_id, customer_name, customer_phone, total, paid_at, created_at, rating";
