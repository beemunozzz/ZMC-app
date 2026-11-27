// Weather from the free National Weather Service (api.weather.gov). Server only.
import { cacheLife } from "next/cache";
import { periodsToDays, worse, type DayWx, type JobWx, type Wx, type WxStop } from "./weather-kinds";

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
