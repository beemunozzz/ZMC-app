// Crew initials in circles, so you can see who's on a job at a glance.
// Colors come from ZMC's own palette; each person always gets the same one.
const TONES = [
  "bg-primary/15 text-primary",
  "bg-tape/25 text-ink",
  "bg-ok/15 text-ok",
  "bg-warn/15 text-warn",
  "bg-line text-ink",
];

function initials(name: string) {
  const parts = name.replace(/^example:\s*/i, "").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
function tone(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

export function Avatars({
  people,
  leadId,
  max = 4,
  size = "md",
}: {
  people: { id: string; name: string }[];
  leadId?: string | null;
  max?: number;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-7 w-7 text-[11px]" : "h-9 w-9 text-xs";
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  if (!people.length) return null;
  return (
    <span className="flex items-center -space-x-1.5" aria-label={people.map((p) => p.name + (p.id === leadId ? " (lead)" : "")).join(", ")}>
      {shown.map((p) => (
        <span
          key={p.id}
          title={p.name + (p.id === leadId ? " · lead" : "")}
          className={`relative flex ${dim} items-center justify-center rounded-full font-bold ring-2 ring-[var(--card)] ${tone(p.id)} ${p.id === leadId ? "outline outline-2 outline-tape" : ""}`}
          aria-hidden
        >
          {initials(p.name)}
        </span>
      ))}
      {extra > 0 && (
        <span className={`relative flex ${dim} items-center justify-center rounded-full bg-line font-semibold text-ink ring-2 ring-[var(--card)]`} aria-hidden>
          +{extra}
        </span>
      )}
    </span>
  );
}
