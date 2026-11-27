import { WX_EMOJI, WX_LABEL, WX_TIP, WX_WATCH, outlookText, outlookWet, type JobOutlook, type JobWx } from "@/lib/weather-kinds";

/** Weather for one job: the worst of its stops (and where), each stop on its own line, and a crew tip. */
export function WeatherNote({ wx, past }: { wx?: JobWx | null; past?: boolean }) {
  if (!wx) return null;
  const watch = WX_WATCH.includes(wx.kind);
  // One tip per kind of bad weather on the job (e.g. rain at the drop-off and wind on the drive).
  const kinds = [wx.kind, ...(wx.stops ?? []).map((s) => s.wx.kind).filter((k) => WX_WATCH.includes(k))];
  const tips = past ? [] : [...new Set(kinds)].map((k) => WX_TIP[k]).filter((x): x is string => !!x);
  const where = wx.where ? (wx.where === "the drive" ? " on the drive" : ` in ${wx.where}`) : "";
  return (
    <div className={`rounded-xl px-3 py-2.5 text-sm ${watch ? "bg-warn/12 text-warn" : "bg-bg text-ink"}`}>
      <p className="font-semibold">
        <span aria-hidden>{WX_EMOJI[wx.kind]}</span> {watch ? WX_LABEL[wx.kind] : wx.text || WX_LABEL[wx.kind]}
        {where}
        {!wx.stops && wx.hi != null && <span className="font-normal tabular-nums"> · high {wx.hi}°</span>}
        {!wx.stops && wx.pop ? <span className="font-normal tabular-nums"> · {wx.pop}% rain</span> : null}
        {!wx.stops && wx.atSite && <span className="font-normal"> · at the job site</span>}
      </p>
      {wx.stops && (
        <ul className="mt-1 flex flex-col gap-0.5 text-ink">
          {wx.stops.map((s) => {
            const bad = WX_WATCH.includes(s.wx.kind);
            return (
              <li key={s.label} className="flex items-baseline justify-between gap-3 tabular-nums">
                <span className="min-w-0 truncate">
                  <span className="text-muted">{s.label}</span>
                  {s.label !== "On the drive" && s.place ? ` · ${s.place}` : ""}
                </span>
                <span className={`shrink-0 ${bad ? "font-semibold text-warn" : ""}`}>
                  <span aria-hidden>{WX_EMOJI[s.wx.kind]}</span> {bad ? WX_LABEL[s.wx.kind] : s.wx.hi != null ? `${s.wx.hi}°` : WX_LABEL[s.wx.kind]}
                  {bad && s.wx.pop ? ` · ${s.wx.pop}%` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {tips.map((tip) => (
        <p key={tip} className="mt-1">
          {tip}
        </p>
      ))}
    </div>
  );
}

/** Days 8-14: NOAA's rough outlook, in grey. The real forecast replaces it 7 days before the move. */
export function OutlookNote({ o }: { o?: JobOutlook | null }) {
  if (!o) return null;
  return (
    <div className="rounded-xl bg-bg px-3 py-2.5 text-sm text-ink">
      <p className="font-semibold">
        <span aria-hidden>{outlookWet(o) ? "🌦️" : "🗓️"}</span> 8–14 day outlook <span className="font-normal text-muted">(rough)</span>
      </p>
      <p>
        {o.where ? `Around ${o.where}: ` : ""}
        {outlookText(o).replace(/^./, (c) => c.toUpperCase())}.
      </p>
      <p className="mt-0.5 text-xs text-muted">The real forecast shows up 7 days before the move.</p>
    </div>
  );
}
