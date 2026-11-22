// Weather from the free National Weather Service (api.weather.gov). Server only.
import { cacheLife } from "next/cache";
import { periodsToDays, worse, type DayWx, type JobWx, type Wx } from "./weather-kinds";

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

/** A job's weather: the worse of its pickup and drop-off cities. Falls back to Stockton. */
export async function jobForecast(
  job: { job_date: string; pickup_address: string; dropoff_address: string },
  stockton: Record<string, DayWx>,
): Promise<JobWx | null> {
  const home = stockton[job.job_date];
  let best: DayWx | null = null;
  for (const addr of [job.pickup_address, job.dropoff_address].filter((a) => a.trim().length > 5)) {
    const spot = await withTimeout(geocode(addr), 3000);
    if (!spot) continue;
    const fc = await withTimeout(forecastAt(spot.lat, spot.lon), 4000);
    best = worse(best, fc?.[job.job_date]);
  }
  const pick = best ?? home;
  if (!pick) return null;
  return { ...pick, atSite: !!best && (!home || (best.kind as Wx) !== home.kind) };
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
