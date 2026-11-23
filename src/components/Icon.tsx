// One icon family for the whole app: 24px grid, 1.8 stroke, round caps. Replaces emoji and
// keyboard symbols (☰ ✕ ⚠ ✓ ★ 🚚 ›) so every icon has the same weight and alignment.
// Weather keeps its emoji on purpose: Brandon's brief asks for ☀️ ☁️ 🌧️ 🔥 💨.

const PATHS = {
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  chevron: <path d="M9 5l7 7-7 7" />,
  back: <path d="M15 5l-7 7 7 7" />,
  alert: (
    <>
      <path d="M12 3.5l9.5 16.5h-19z" />
      <path d="M12 10v4.5M12 17.4v.1" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  star: <path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.7l-5.1 2.7 1-5.6-4.1-4 5.7-.8z" />,
  truck: (
    <>
      <path d="M3 6.5h11v9H3zM14 9.5h3.8l3.2 3.4v2.6h-7" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17.5" cy="17.5" r="1.8" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  phone: <path d="M6.6 3.5h2.6l1.4 4-1.9 1.4a11 11 0 0 0 6.4 6.4l1.4-1.9 4 1.4v2.6a1.6 1.6 0 0 1-1.7 1.6A15.8 15.8 0 0 1 5 5.2a1.6 1.6 0 0 1 1.6-1.7z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "h-5 w-5", label, filled }: { name: IconName; className?: string; label?: string; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {PATHS[name]}
    </svg>
  );
}
