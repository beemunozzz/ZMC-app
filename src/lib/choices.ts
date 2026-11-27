// Dropdown choices used across the app, so every screen offers the same options. Safe on the server and the phone.

/** Movers: 1 to 10. */
export const moverChoices = (min = 1, max = 10) => Array.from({ length: max - min + 1 }, (_, i) => min + i);

/** "4 hrs", "4 hrs 30 min", "1 hr 15 min". */
export function hoursLabel(h: number) {
  const whole = Math.floor(h);
  const min = Math.round((h - whole) * 60);
  const hrs = whole ? `${whole} hr${whole === 1 ? "" : "s"}` : "";
  return [hrs, min ? `${min} min` : ""].filter(Boolean).join(" ") || "0 hrs";
}

/**
 * Hour choices from `min` to `max` in `step` steps (0.5 = half hours, 0.25 = quarter hours).
 * A saved value that isn't on the list (e.g. 4.4) is added, so it never disappears.
 */
export function hourChoices(step: number, min: number, max: number, current?: string | number | null) {
  const list: number[] = [];
  for (let h = min; h <= max + 1e-9; h += step) list.push(Math.round(h * 100) / 100);
  const cur = Number(current);
  if (current !== "" && current != null && Number.isFinite(cur) && cur > 0 && !list.includes(cur)) {
    list.push(cur);
    list.sort((a, b) => a - b);
  }
  return list;
}
