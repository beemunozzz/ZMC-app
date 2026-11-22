import { WX_EMOJI, WX_LABEL, WX_TIP, WX_WATCH, type JobWx } from "@/lib/weather-kinds";

/** Weather line for one job, plus a crew tip when the weather matters. */
export function WeatherNote({ wx }: { wx?: JobWx | null }) {
  if (!wx) return null;
  const watch = WX_WATCH.includes(wx.kind);
  const tip = WX_TIP[wx.kind];
  return (
    <div className={`rounded-xl px-3 py-2.5 text-sm ${watch ? "bg-warn/12 text-warn" : "bg-bg text-ink"}`}>
      <p className="font-semibold">
        <span aria-hidden>{WX_EMOJI[wx.kind]}</span> {watch ? WX_LABEL[wx.kind] : wx.text || WX_LABEL[wx.kind]}
        {wx.hi != null && <span className="font-normal tabular-nums"> · high {wx.hi}°</span>}
        {wx.pop ? <span className="font-normal tabular-nums"> · {wx.pop}% rain</span> : null}
        {wx.atSite && <span className="font-normal"> · at the job site</span>}
      </p>
      {tip && <p className="mt-0.5">{tip}</p>}
    </div>
  );
}
