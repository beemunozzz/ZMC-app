import { WX_EMOJI, WX_LABEL, WX_TIP, WX_WATCH, type JobWx } from "@/lib/weather-kinds";

/** Weather for one job: the worst of its stops (and where), each stop on its own line, and a crew tip. */
export function WeatherNote({ wx }: { wx?: JobWx | null }) {
  if (!wx) return null;
  const watch = WX_WATCH.includes(wx.kind);
  const tip = WX_TIP[wx.kind];
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
      {tip && <p className="mt-1">{tip}</p>}
    </div>
  );
}
