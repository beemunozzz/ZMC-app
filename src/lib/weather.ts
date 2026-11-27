// Weather from the free National Weather Service (api.weather.gov). Server only.
import { cacheLife } from "next/cache";
import { periodsToDays, worse, type DayWx, type JobOutlook, type JobWx, type Lean, type Outlook, type Wx, type WxStop } from "./weather-kinds";

const UA = "ZMC Hub (zmcmove.com)";
export const STOCKTON = { lat: 37.9577, lon: -121.2908 };

async function getJSON(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/geo+json, application/json" } });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  return res.json();
}

/** Daily forecast for a spot, about 7 days ahead. Saved for an hour. Throws if NWS can't be reached. */
export async function forecastAt(lat: number, lon: number): Promise<Record<string, DayWx>> {
  "use cache";
  cacheLife("hours");
  const point = await getJSON(`https://api.weather.gov/points/${lat.toFixed(3)},${lon.toFixed(3)}`);
  const url: string | undefined = point?.properties?.forecast;
  if (!url) throw new Error("No forecast for this spot");
  const fc = await getJSON(url);
  return periodsToDays(fc?.properties?.periods ?? []);
}

/** Address -> map spot, using the free US Census geocoder. Saved for good. */
export async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
  "use cache";
  cacheLife("max");
  const url =
    "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=json&address=" +
    encodeURIComponent(address);
  const data = await getJSON(url);
  const c = data?.result?.addressMatches?.[0]?.coordinates;
  return c ? { lat: Math.round(c.y * 100) / 100, lon: Math.round(c.x * 100) / 100 } : null;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

/** Stockton's forecast. Empty if the weather service is down, so pages still load. */
export async function stocktonForecast() {
  return (await withTimeout(forecastAt(STOCKTON.lat, STOCKTON.lon), 4000)) ?? {};
}

/** Miles between two map spots (straight line). */
function milesApart(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 2 * 3959 * Math.asin(Math.sqrt(h));
}
/** Moves at least this far apart (straight line, about 25 road miles) also check halfway along the drive. */
const MIDPOINT_MILES = 20;

const cityName = (address: string) => {
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  return (parts.length >= 2 ? parts[1] : parts[0]) ?? "";
};

/**
 * A job's weather: the worst of its pickup, its drop-off and (on longer moves) halfway along the drive,
 * with each stop listed. Falls back to Stockton when the addresses can't be found.
 */
export async function jobForecast(
  job: { job_date: string; pickup_address: string; dropoff_address: string },
  stockton: Record<string, DayWx>,
): Promise<JobWx | null> {
  const home = stockton[job.job_date];
  const [pick, drop] = await Promise.all(
    [job.pickup_address, job.dropoff_address].map((a) => (a.trim().length > 5 ? withTimeout(geocode(a), 3000) : Promise.resolve(null))),
  );
  const spots: { label: WxStop["label"]; place: string; at: { lat: number; lon: number } }[] = [];
  if (pick) spots.push({ label: "Pickup", place: cityName(job.pickup_address), at: pick });
  if (pick && drop && milesApart(pick, drop) >= MIDPOINT_MILES)
    spots.push({ label: "On the drive", place: "the drive", at: { lat: Math.round(((pick.lat + drop.lat) / 2) * 100) / 100, lon: Math.round(((pick.lon + drop.lon) / 2) * 100) / 100 } });
  if (drop && !(pick && drop.lat === pick.lat && drop.lon === pick.lon)) spots.push({ label: "Drop-off", place: cityName(job.dropoff_address), at: drop });

  const stops: WxStop[] = [];
  for (const s of await Promise.all(spots.map(async (s) => ({ ...s, fc: await withTimeout(forecastAt(s.at.lat, s.at.lon), 4000) })))) {
    const wx = s.fc?.[job.job_date];
    if (wx) stops.push({ label: s.label, place: s.place, wx });
  }
  let best: DayWx | null = null;
  let bestStop: WxStop | null = null;
  for (const st of stops) {
    if (worse(best, st.wx) !== best) {
      best = st.wx;
      bestStop = st;
    }
  }
  const out = best ?? home;
  if (!out) return null;
  // Name the place only when the stops disagree (otherwise it's the same everywhere on the job).
  const differs = stops.some((st) => st.wx.kind !== out.kind);
  return {
    ...out,
    atSite: !!best && (!home || (best.kind as Wx) !== home.kind),
    where: bestStop && differs ? bestStop.place : undefined,
    stops: stops.length > 1 ? stops : undefined,
  };
}

/** Weather for many jobs at once (only the next 7 days have a forecast). */
export async function jobsForecast(
  jobs: { id: string; job_date: string; pickup_address: string; dropoff_address: string }[],
  stockton: Record<string, DayWx>,
) {
  const dates = new Set(Object.keys(stockton));
  const list = await Promise.all(
    jobs.filter((j) => dates.has(j.job_date)).map(async (j) => [j.id, await jobForecast(j, stockton)] as const),
  );
  return new Map(list.filter((x): x is readonly [string, JobWx] => !!x[1]));
}

// ---- NOAA's 8-14 day outlook (rough), for days past the 7-day forecast ----
const CPC = "https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/cpc_8_14_day_outlk/MapServer";
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Strongest lean at a spot on one outlook layer (0 = temperature, 1 = rain). Null = no strong signal ("equal chances"). */
async function leanAt(layer: 0 | 1, lat: number, lon: number) {
  const url =
    `${CPC}/${layer}/query?geometry=${lon.toFixed(2)},${lat.toFixed(2)}&geometryType=esriGeometryPoint&inSR=4326` +
    "&spatialRel=esriSpatialRelIntersects&outFields=cat,prob,start_date,end_date&returnGeometry=false&f=json";
  const data = await getJSON(url);
  const rows = ((data?.features ?? []) as { attributes: { cat: string; prob: number; start_date: number; end_date: number } }[]).map((f) => f.attributes);
  const best = rows.sort((a, b) => (b.prob ?? 0) - (a.prob ?? 0))[0];
  if (!best) return { lean: null as Lean | null, start: null as string | null, end: null as string | null };
  const cat = best.cat === "Above" || best.cat === "Below" ? best.cat : "Normal";
  return { lean: { cat, prob: Math.round(best.prob ?? 0) } as Lean, start: isoDay(best.start_date), end: isoDay(best.end_date) };
}

/** The 8-14 day outlook at a spot. Saved for a few hours (NOAA updates it once a day). */
export async function outlookAt(lat: number, lon: number): Promise<Outlook | null> {
  "use cache";
  cacheLife("hours");
  const [temp, rain] = await Promise.all([leanAt(0, lat, lon), leanAt(1, lat, lon)]);
  const start = rain.start ?? temp.start;
  const end = rain.end ?? temp.end;
  if (!start || !end) return null;
  return { start, end, rain: rain.lean, temp: temp.lean };
}

/** Stockton's outlook (for the month view). Null if NOAA can't be reached. */
export async function stocktonOutlook() {
  return withTimeout(outlookAt(STOCKTON.lat, STOCKTON.lon), 4000);
}

/** A job's outlook: wettest of the pickup and drop-off. Only for jobs inside the outlook's dates. */
export async function jobOutlook(job: { job_date: string; pickup_address: string; dropoff_address: string }, window: Outlook | null): Promise<JobOutlook | null> {
  if (!window || job.job_date < window.start || job.job_date > window.end) return null;
  const stops = await Promise.all(
    [job.pickup_address, job.dropoff_address]
      .filter((a) => a.trim().length > 5)
      .map(async (a) => {
        const at = await withTimeout(geocode(a), 3000);
        const o = at ? await withTimeout(outlookAt(at.lat, at.lon), 4000) : null;
        return o ? { o, place: cityName(a) } : null;
      }),
  );
  const found = stops.filter((s): s is { o: Outlook; place: string } => !!s);
  if (!found.length) return window;
  const score = (o: Outlook) => (o.rain?.cat === "Above" ? 100 + o.rain.prob : o.rain?.cat === "Normal" ? 50 : 0);
  const best = found.sort((a, b) => score(b.o) - score(a.o))[0];
  const differs = found.some((s) => s.o.rain?.cat !== best.o.rain?.cat);
  return { ...best.o, where: differs ? best.place : undefined };
}

/** Outlooks for jobs past the 7-day forecast (days 8-14). */
export async function jobsOutlook(jobs: { id: string; job_date: string; pickup_address: string; dropoff_address: string }[], forecastDates: Set<string>) {
  const later = jobs.filter((j) => !forecastDates.has(j.job_date));
  if (!later.length) return new Map<string, JobOutlook>();
  const window = await stocktonOutlook();
  const list = await Promise.all(later.map(async (j) => [j.id, await jobOutlook(j, window)] as const));
  return new Map(list.filter((x): x is readonly [string, JobOutlook] => !!x[1]));
}

// ---- Working-hours temperatures (7 AM to 8 PM) from the hourly forecast ----
export type DayTemps = { lo: number; hi: number };
const WORK_FROM = 7;
const WORK_TO = 20;

/** Low and high between 7 AM and 8 PM for each date, about 6 days ahead. Saved for an hour. */
export async function workTempsAt(lat: number, lon: number): Promise<Record<string, DayTemps>> {
  "use cache";
  cacheLife("hours");
  const point = await getJSON(`https://api.weather.gov/points/${lat.toFixed(3)},${lon.toFixed(3)}`);
  const url: string | undefined = point?.properties?.forecastHourly;
  if (!url) return {};
  const fc = await getJSON(url);
  const out: Record<string, DayTemps> = {};
  for (const p of (fc?.properties?.periods ?? []) as { startTime: string; temperature: number; temperatureUnit: string }[]) {
    const hour = Number(p.startTime.slice(11, 13)); // NWS times are already local
    if (hour < WORK_FROM || hour > WORK_TO || p.temperature == null) continue;
    const f = p.temperatureUnit === "C" ? Math.round(p.temperature * 1.8 + 32) : p.temperature;
    const d = (out[p.startTime.slice(0, 10)] ??= { lo: f, hi: f });
    d.lo = Math.min(d.lo, f);
    d.hi = Math.max(d.hi, f);
  }
  return out;
}

/** A job's working-hours low and high, at the pickup (Stockton if the address can't be found). */
export async function jobTemps(job: { job_date: string; pickup_address: string }): Promise<DayTemps | null> {
  const at = job.pickup_address.trim().length > 5 ? await withTimeout(geocode(job.pickup_address), 3000) : null;
  const spot = at ?? STOCKTON;
  const temps = await withTimeout(workTempsAt(spot.lat, spot.lon), 4000);
  return temps?.[job.job_date] ?? null;
}
