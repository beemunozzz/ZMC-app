import { houseLine, seeHouseUrl, zillowUrl, type House } from "@/lib/jobs";
import { NavigateLink } from "./NavigateLink";

/**
 * The route drawn as a line: Pickup ● ──── ● Drop-off, each stop with its address, house
 * details and a Navigate button right there. Replaces two separate address boxes.
 */
export function RouteLine({
  pickup,
  pickupHouse,
  dropoff,
  dropoffHouse,
}: {
  pickup: string;
  pickupHouse: House;
  dropoff: string;
  dropoffHouse: House;
}) {
  const stops = [
    { label: "Pickup", address: pickup, house: pickupHouse, primary: true },
    { label: "Drop-off", address: dropoff, house: dropoffHouse, primary: false },
  ].filter((s) => s.address);
  if (!stops.length) return null;

  return (
    <ol className="relative flex flex-col">
      {stops.map((s, i) => {
        const line = houseLine(s.house);
        const last = i === stops.length - 1;
        return (
          <li key={s.label} className="relative grid grid-cols-[1.25rem_1fr] gap-x-3 pb-5 last:pb-0">
            {/* the dot and the line to the next stop */}
            <span className="relative flex justify-center pt-1" aria-hidden>
              <span className={`z-10 h-3.5 w-3.5 rounded-full ${s.primary ? "bg-tape" : "border-2 border-tape bg-[var(--card)]"}`} />
              {!last && <span className="absolute bottom-[-1.25rem] top-4 w-0.5 rounded-full bg-gradient-to-b from-tape to-tape/30" />}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">{s.label}</p>
              <p className="break-words text-[15px] font-semibold text-ink">{s.address}</p>
              {line && <p className="mt-0.5 break-words text-sm text-muted">{line}</p>}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <NavigateLink
                  address={s.address}
                  className={`press col-span-2 flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold ${
                    s.primary ? "bg-primary text-white dark:text-navy" : "border border-line text-ink"
                  }`}
                >
                  Navigate
                </NavigateLink>
                <a href={zillowUrl(s.address)} target="_blank" rel="noopener" className="press flex h-10 items-center justify-center rounded-xl border border-line px-3 text-sm font-medium text-ink">
                  Zillow
                </a>
                <a href={seeHouseUrl(s.address)} target="_blank" rel="noopener" className="press flex h-10 items-center justify-center rounded-xl border border-line px-3 text-sm font-medium text-ink">
                  See the house
                </a>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
