// Jobs: types, labels and small helpers. Safe to use on both the server and the phone.
import { fmtMinutes, fmtTime, minutes } from "./dates";

export type JobStatus = "booked" | "confirmed" | "done" | "canceled";
export type Truck = "ours" | "theirs";

export type House = {
  type?: string;
  gated?: string;
  stories?: string;
  beds?: string;
  baths?: string;
  sqft?: string;
  garage?: string;
  built?: string;
};

export type Job = {
  id: string;
  job_date: string;
  start_time: string | null;
  est_hours: number | null;
  pickup_address: string;
  pickup_house: House;
  dropoff_address: string;
  dropoff_house: House;
  customer_name: string;
  customer_phone: string;
  job_type: string;
  truck: Truck;
  status: JobStatus;
  movers_needed: number;
  lead_id: string | null;
  crew_ids: string[];
  heavy_items: string;
  notes: string;
  nte: number | null;
  quote_id: string | null;
  /** Where the crew meets: the shop (Zach's house) or the job site. */
  meet_at: "shop" | "site";
  /** Drive time shop -> pickup that Zach typed in (minutes). Null = worked out automatically. */
  drive_min: number | null;
  miles_out: number | null;
  /** Extra load-up checklist items for this job only (one per line). */
  load_extra: string;
};

export const JOB_COLUMNS =
  "id, job_date, start_time, est_hours, pickup_address, pickup_house, dropoff_address, dropoff_house, customer_name, customer_phone, job_type, truck, status, movers_needed, lead_id, crew_ids, heavy_items, notes, nte, quote_id, meet_at, drive_min, miles_out, load_extra";

export const JOB_TYPES = [
  "Full move",
  "Partial move",
  "Garage only",
  "Same property",
  "Storage unit",
  "Pod load/unload",
  "Office move",
  "Labor only",
];

export const STATUS: Record<JobStatus, { label: string; cls: string }> = {
  booked: { label: "Booked", cls: "bg-primary/10 text-primary" },
  confirmed: { label: "Confirmed", cls: "bg-ok/12 text-ok" },
  done: { label: "Done", cls: "bg-line text-muted" },
  canceled: { label: "Canceled", cls: "bg-bad/10 text-bad" },
};

export const HOUSE_TYPES = ["House", "Condo", "Townhouse", "Apartment", "Mobile home", "Duplex"];

export const HOUSE_FIELDS: { key: keyof House; label: string; options?: string[]; placeholder?: string; mode?: "numeric" | "decimal" }[] = [
  { key: "type", label: "Type", options: HOUSE_TYPES },
  { key: "gated", label: "Gated", options: ["Yes", "No"] },
  { key: "stories", label: "Stories", options: ["1", "2", "3"] },
  { key: "beds", label: "Beds", mode: "numeric" },
  { key: "baths", label: "Baths", mode: "decimal", placeholder: "2.5" },
  { key: "sqft", label: "Sq ft", mode: "numeric" },
  { key: "garage", label: "Garage spaces", mode: "numeric", placeholder: "0 = none" },
  { key: "built", label: "Year built", mode: "numeric" },
];

/** "House · 2 stories · 3 bed · 2.5 bath · 1,878 sq ft · 2-car garage · built 1998" */
export function houseLine(h: House | null | undefined) {
  if (!h) return "";
  const v = (k: keyof House) => String(h[k] ?? "").trim();
  const parts: string[] = [];
  if (v("type")) parts.push(v("type"));
  if (v("stories")) parts.push(v("stories") === "1" ? "1 story" : `${v("stories")} stories`);
  if (v("beds")) parts.push(`${v("beds")} bed`);
  if (v("baths")) parts.push(`${v("baths")} bath`);
  if (v("sqft")) {
    const n = Number(v("sqft").replace(/,/g, ""));
    parts.push(n ? `${n.toLocaleString("en-US")} sq ft` : `${v("sqft")} sq ft`);
  }
  if (v("garage")) parts.push(/^0$|^no(ne)?$/i.test(v("garage")) ? "no garage" : `${v("garage")}-car garage`);
  if (v("built")) parts.push(`built ${v("built")}`);
  if (/^y/i.test(v("gated"))) parts.push("gated");
  return parts.join(" · ");
}

/** "123 Main St, Lodi, CA 95240" -> "Lodi" */
export function cityOf(address: string) {
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[1] : parts[0] ?? "";
}

const q = encodeURIComponent;
export const navigateUrl = (a: string) => `https://www.google.com/maps/dir/?api=1&destination=${q(a)}`;
export const seeHouseUrl = (a: string) => `https://www.google.com/maps/search/?api=1&query=${q(a)}`;
export const zillowUrl = (a: string) => `https://www.zillow.com/homes/${q(a).replace(/%20/g, "-")}_rb/`;
export const telUrl = (p: string) => `tel:${p.replace(/[^0-9+]/g, "")}`;

export const jobCrew = (j: Pick<Job, "lead_id" | "crew_ids">) =>
  [j.lead_id, ...(j.crew_ids ?? [])].filter((x): x is string => !!x);

export const isLive = (j: Pick<Job, "status">) => j.status !== "canceled" && j.status !== "done";

/** How many more people the job needs (0 if fully staffed). */
export const openSpots = (j: Job) => Math.max(0, (j.movers_needed || 2) - jobCrew(j).length);

/** "8 AM – about 11 AM" */
export function timeSpan(j: Pick<Job, "start_time" | "est_hours">) {
  const s = minutes(j.start_time);
  if (s == null) return "Time not set";
  const h = Number(j.est_hours) || 0;
  return h ? `${fmtTime(j.start_time)} – ${fmtMinutes(s + h * 60)}` : fmtTime(j.start_time);
}

/** People on this job who are also on an overlapping job the same day (allowing 30 min to drive). */
export function conflicts(j: Job, sameDay: Job[]) {
  if (j.status === "canceled") return [];
  const range = (x: Job) => {
    const s = minutes(x.start_time);
    if (s == null) return null;
    return [s, s + (Number(x.est_hours) || 2) * 60 + 30] as const;
  };
  const a = range(j);
  const mine = new Set(jobCrew(j));
  const out: { crewId: string; other: Job }[] = [];
  for (const o of sameDay) {
    if (o.id === j.id || o.job_date !== j.job_date || o.status === "canceled") continue;
    const b = range(o);
    const overlap = !a || !b ? true : a[0] < b[1] && b[0] < a[1];
    if (!overlap) continue;
    for (const id of jobCrew(o)) if (mine.has(id)) out.push({ crewId: id, other: o });
  }
  return out;
}
