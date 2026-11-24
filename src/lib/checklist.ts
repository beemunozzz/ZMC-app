// The "before you leave" load-up checklist. Safe on the server and the phone.

export type ChecklistItem = { label: string; done: boolean; by?: string };

const RAIN = /\s*\(rain\)\s*$/i;

/**
 * This job's list: Zach's everyday list (rain-only items when rain is expected), then this job's extras.
 * One item per line; duplicates are dropped.
 */
export function itemsFor(loadList: string, extra: string, rainy: boolean) {
  const lines = [
    ...loadList.split(/\r?\n/).filter((l) => !RAIN.test(l) || rainy).map((l) => l.replace(RAIN, "")),
    ...extra.split(/\r?\n|,/),
  ]
    .map((l) => l.trim().slice(0, 80))
    .filter(Boolean);
  return [...new Set(lines)];
}
