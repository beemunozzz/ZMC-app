import { WX_EMOJI, WX_WATCH, type JobWx } from "@/lib/weather-kinds";

/**
 * A day's weather emoji. Rain, snow, heat and wind sit in a small orange circle so they stand out;
 * the little orange dot means the weather is at a job site, not in Stockton. `faded` = the 8-14 day outlook.
 */
export function WxIcon({ wx, wetLater, size = "sm" }: { wx: Pick<JobWx, "kind" | "atSite"> | null; wetLater?: boolean; size?: "sm" | "md" }) {
  const box = size === "md" ? "h-6 w-6 text-sm" : "h-[18px] w-[18px] text-[11px] md:h-6 md:w-6 md:text-sm";
  if (!wx) {
    if (!wetLater) return null;
    return <span className={`flex ${box} items-center justify-center leading-none opacity-50`}>🌦️</span>;
  }
  const watch = WX_WATCH.includes(wx.kind);
  return (
    <span className={`relative flex ${box} items-center justify-center rounded-full leading-none ${watch ? "bg-warn-fill" : ""}`}>
      {WX_EMOJI[wx.kind]}
      {wx.atSite && <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-warn-fill ring-2 ring-card" />}
    </span>
  );
}
