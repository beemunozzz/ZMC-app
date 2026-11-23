"use client";

import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";

/** Light / Dark / Automatic. Saved on this phone only. */
export function ThemePicker() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      const t = localStorage.getItem("zmc-theme");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read the saved choice once, after the page loads
      if (t === "light" || t === "dark") setTheme(t);
    } catch {
      /* private browsing: just use Automatic */
    }
  }, []);

  function choose(t: Theme) {
    setTheme(t);
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
    try {
      if (t === "system") localStorage.removeItem("zmc-theme");
      else localStorage.setItem("zmc-theme", t);
    } catch {
      /* can't save; it still applies until the app is closed */
    }
  }

  const options: [Theme, string, string][] = [
    ["system", "Automatic", "Matches your phone"],
    ["light", "Light", "Bright, for daytime"],
    ["dark", "Dark", "Easy on the eyes"],
  ];
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Appearance">
      {options.map(([k, label, sub]) => (
        <button
          key={k}
          role="radio"
          aria-checked={theme === k}
          onClick={() => choose(k)}
          className={`press flex min-h-20 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 text-center ${
            theme === k ? "border-primary bg-primary/10" : "border-line"
          }`}
        >
          <span className="text-[15px] font-semibold text-ink">{label}</span>
          <span className="text-xs text-muted">{sub}</span>
        </button>
      ))}
    </div>
  );
}
