// Weather kinds, emojis and tips. Safe to use on both the server and the phone.
export type Wx = "clear" | "cloudy" | "fog" | "rain" | "hot" | "wind";

export type DayWx = {
  kind: Wx;
  /** Daytime high in °F */
  hi?: number;
  /** NWS words, e.g. "Chance Rain Showers" */
  text: string;
  /** Chance of rain, 0-100 */
  pop?: number;
};

export type JobWx = DayWx & { atSite: boolean };

export const WX_EMOJI: Record<Wx, string> = {
  clear: "☀️",
  cloudy: "☁️",
  fog: "☁️",
  rain: "🌧️",
  hot: "🔥",
  wind: "💨",
};

export const WX_LABEL: Record<Wx, string> = {
  clear: "Clear",
  cloudy: "Cloudy",
  fog: "Fog",
  rain: "Rain likely",
  hot: "Hot (100°F+)",
  wind: "Windy",
};

export const WX_TIP: Partial<Record<Wx, string>> = {
  rain: "Rain expected: bring extra blankets, plastic covers and floor runners.",
  hot: "Hot day: extra water, start early, take breaks in the shade.",
  wind: "Windy: strap loads tight and watch mattresses and boxes on the ramp.",
  fog: "Morning fog (tule fog): leave early and drive carefully.",
};

/** Weather worth warning the crew about. */
export const WX_WATCH: Wx[] = ["rain", "hot", "wind", "fog"];

/** Worst first. */
const RANK: Wx[] = ["rain", "hot", "wind", "fog", "cloudy", "clear"];

export function worse<T extends { kind: Wx }>(a: T | null | undefined, b: T | null | undefined): T | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return RANK.indexOf(b.kind) < RANK.indexOf(a.kind) ? b : a;
}

/** Turn one NWS forecast period into a weather kind. */
export function classify(p: {
  shortForecast?: string;
  isDaytime?: boolean;
  temperature?: number;
  temperatureUnit?: string;
  windSpeed?: string;
  probabilityOfPrecipitation?: { value: number | null } | null;
}): Wx | null {
  const t = (p.shortForecast ?? "").toLowerCase();
  const pop = p.probabilityOfPrecipitation?.value;
  const wet = /thunder|rain|shower|drizzle|sleet|snow/.test(t);
  if (wet && (pop == null || pop >= 40)) return "rain";
  const tempF = p.temperatureUnit === "C" && p.temperature != null ? p.temperature * 1.8 + 32 : p.temperature;
  if (p.isDaytime && tempF != null && tempF >= 100) return "hot";
  const mph = Math.max(0, ...(p.windSpeed ?? "").match(/\d+/g)?.map(Number) ?? [0]);
  if (mph >= 20 || /breezy|windy|gust/.test(t)) return "wind";
  if (/fog/.test(t)) return "fog";
  if (!p.isDaytime) return null; // at night, only rain, wind and fog matter
  if (wet || /mostly cloudy|overcast|^cloudy|partly sunny|haze|smoke/.test(t)) return "cloudy";
  return "clear";
}

export type Period = Parameters<typeof classify>[0] & { startTime: string };

/** Turn NWS forecast periods (day and night) into one entry per date. */
export function periodsToDays(periods: Period[]): Record<string, DayWx> {
  const acc: Record<string, { kind: Wx | null; hi?: number; text: string; pop: number }> = {};
  for (const p of periods) {
    const date = p.startTime.slice(0, 10); // NWS times are already local
    const d = (acc[date] ??= { kind: null, text: "", pop: 0 });
    const kind = classify(p);
    if (kind) d.kind = worse(d.kind ? { kind: d.kind } : null, { kind })!.kind;
    if (p.isDaytime) {
      d.hi = p.temperature;
      d.text = p.shortForecast ?? d.text;
    } else if (!d.text) d.text = p.shortForecast ?? "";
    d.pop = Math.max(d.pop, p.probabilityOfPrecipitation?.value ?? 0);
  }
  const days: Record<string, DayWx> = {};
  for (const [date, d] of Object.entries(acc)) {
    days[date] = { kind: d.kind ?? "clear", hi: d.hi, text: d.text, pop: d.pop || undefined };
  }
  return days;
}

