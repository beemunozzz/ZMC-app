import { houseLine, navigateUrl, seeHouseUrl, zillowUrl, type House } from "@/lib/jobs";

const btn = "press flex h-11 items-center justify-center rounded-xl px-3 text-sm font-semibold";

export function AddressBlock({
  label,
  address,
  house,
  primary,
}: {
  label: string;
  address: string;
  house: House;
  /** Make "Navigate" the big blue button (the crew's next stop). */
  primary?: boolean;
}) {
  if (!address) return null;
  const line = houseLine(house);
  return (
    <div className="rounded-xl border border-line p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-0.5 break-words text-[15px] font-medium text-ink">{address}</p>
      <p className={`mt-1 break-words text-sm ${line ? "text-ink" : "text-muted"}`}>{line || "House details not filled in yet."}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <a
          href={navigateUrl(address)}
          target="_blank"
          rel="noopener"
          className={`${btn} col-span-2 ${primary ? "bg-primary text-white dark:text-navy" : "border border-line text-ink"}`}
        >
          Navigate
        </a>
        <a href={zillowUrl(address)} target="_blank" rel="noopener" className={`${btn} border border-line text-ink`}>
          Zillow
        </a>
        <a href={seeHouseUrl(address)} target="_blank" rel="noopener" className={`${btn} border border-line text-ink`}>
          See the house
        </a>
      </div>
    </div>
  );
}
