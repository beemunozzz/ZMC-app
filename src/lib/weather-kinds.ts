// Weather kinds, emojis and tips. Safe to use on both the server and the phone.
export type Wx = "clear" | "cloudy" | "fog" | "rain" | "snow" | "hot" | "wind";

export type DayWx = {
  kind: Wx;
  /** Daytime high in °F */
  hi?: number;
  /** NWS words, e.g. "Chance Rain Showers" */
  text: string;
  /** Chance of rain, 0-100 */
  pop?: number;
};

/** One place on a job: the pickup, the drop-off, or halfway along the drive. */
export type WxStop = { label: "Pickup" | "Drop-off" | "On the drive"; place: string; wx: DayWx };

/**
 * A job's weather: the worst of its stops. `where` names the worst place ("Livermore", "the drive")
 * when the stops differ; `stops` has each one for the job page.
 */
export type JobWx = DayWx & { atSite: boolean; where?: string; stops?: WxStop[] };

/** Short words for chips: "Rain in Livermore", "Windy on the drive". */
export const WX_SHORT: Record<Wx, string> = {
  clear: "Clear",
  cloudy: "Cloudy",
  fog: "Fog",
  rain: "Rain",
  snow: "Snow",
  hot: "Hot",
  wind: "Windy",
};

/** "Rain in Livermore" / "Windy on the drive" / "Rain likely". */
export function wxChip(w: Pick<JobWx, "kind" | "where">) {
  if (!w.where) return WX_LABEL[w.kind];
  return `${WX_SHORT[w.kind]} ${w.where === "the drive" ? "on the drive" : `in ${w.where}`}`;
}

export const WX_EMOJI: Record<Wx, string> = {
  clear: "☀️",
  cloudy: "☁️",
  fog: "☁️",
  rain: "🌧️",
  snow: "❄️",
  hot: "🔥",
  wind: "💨",
};

export const WX_LABEL: Record<Wx, string> = {
  clear: "Clear",
  cloudy: "Cloudy",
  fog: "Fog",
  rain: "Rain likely",
  snow: "Snow or ice",
  hot: "Hot (100°F+)",
  wind: "Windy",
};

export const WX_TIP: Partial<Record<Wx, string>> = {
  rain: "Rain expected: bring extra blankets, plastic covers and floor runners.",
  snow: "Snow or ice expected: leave early, drive carefully, and bring extra floor runners and salt for steps.",
  hot: "Hot day: extra water, start early, take breaks in the shade.",
  wind: "Windy: strap loads tight and watch mattresses and boxes on the ramp.",
  fog: "Morning fog (tule fog): leave early and drive carefully.",
};

/** Weather worth warning about in orange. Fog is shown quietly (grey) with its tip, not as a warning. */
export const WX_WATCH: Wx[] = ["rain", "snow", "hot", "wind"];

/** Worst first. */
const RANK: Wx[] = ["snow", "rain", "hot", "wind", "fog", "cloudy", "clear"];

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
  const wet = /thunder|rain|shower|drizzle|sleet|snow|ice|freezing/.test(t);
  if (/snow|sleet|ice|freezing|flurr/.test(t) && (pop == null || pop >= 40)) return "snow";
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


/**
 * NOAA's 8-14 day outlook (rough): is it leaning wetter/drier and warmer/cooler than usual?
 * Only used for days past the 7-day forecast. `prob` is the chance in percent (e.g. 40).
 */
export type Lean = { cat: "Above" | "Below" | "Normal"; prob: number };
export type Outlook = { start: string; end: string; rain: Lean | null; temp: Lean | null };
/** A job's outlook: the wettest of its stops, and where. */
export type JobOutlook = Outlook & { where?: string };

/** Worth a hint on the calendar: leaning wetter than usual. */
export const outlookWet = (o: Pick<Outlook, "rain"> | null | undefined) => o?.rain?.cat === "Above";

export function outlookText(o: Outlook) {
  const parts: string[] = [];
  if (o.rain && o.rain.cat !== "Normal") parts.push(`${o.rain.cat === "Above" ? "wetter" : "drier"} than usual (${o.rain.prob}% chance)`);
  if (o.temp && o.temp.cat !== "Normal") parts.push(`${o.temp.cat === "Above" ? "warmer" : "cooler"} than usual (${o.temp.prob}% chance)`);
  return parts.length ? parts.join(", ") : "about normal";
}
