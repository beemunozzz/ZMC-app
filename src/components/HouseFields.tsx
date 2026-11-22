"use client";

import { HOUSE_FIELDS, type House } from "@/lib/jobs";

const input =
  "h-12 w-full min-w-0 rounded-xl border border-line bg-bg px-3 text-base text-ink outline-none focus:border-primary";
const label = "flex min-w-0 flex-col gap-1 text-sm font-medium text-ink";

/** The 8 house-detail boxes for one address. Field names: `${prefix}_type`, `${prefix}_beds`, ... */
export function HouseFields({ prefix, house, onStories }: { prefix: string; house: House; onStories?: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {HOUSE_FIELDS.map((f) => (
        <label key={f.key} className={label}>
          {f.label}
          {f.options ? (
            <select
              name={`${prefix}_${f.key}`}
              defaultValue={house[f.key] ?? ""}
              className={input}
              onChange={f.key === "stories" && onStories ? (e) => onStories(e.target.value) : undefined}
            >
              <option value="">?</option>
              {f.options.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          ) : (
            <input
              name={`${prefix}_${f.key}`}
              defaultValue={house[f.key] ?? ""}
              inputMode={f.mode}
              placeholder={f.placeholder}
              className={input}
              autoComplete="off"
            />
          )}
        </label>
      ))}
    </div>
  );
}

