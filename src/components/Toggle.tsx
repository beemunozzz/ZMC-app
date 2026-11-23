"use client";

import { useState, useTransition } from "react";

/** The one on/off switch used across the app: label on the left, switch on the right, always in the same spot. */
export function Switch({ on, onClick, label, disabled }: { on: boolean; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`press relative h-9 w-16 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-ok" : "bg-line"}`}
    >
      <span className={`absolute left-0 top-1 h-7 w-7 rounded-full bg-white shadow transition-transform ${on ? "translate-x-8" : "translate-x-1"}`} />
    </button>
  );
}

/** A setting row with a switch that saves itself right away. */
export function ToggleRow({
  title,
  sub,
  initial,
  save,
}: {
  title: string;
  sub?: string;
  initial: boolean;
  save: (on: boolean) => Promise<{ error?: string }>;
}) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[17px] font-semibold text-ink">{title}</p>
          {sub && <p className="text-sm text-muted">{sub}</p>}
        </div>
        <Switch
          on={on}
          label={title}
          disabled={pending}
          onClick={() => {
            const next = !on;
            setOn(next);
            setError("");
            start(async () => {
              const r = await save(next);
              if (r.error) {
                setOn(!next);
                setError(r.error);
              }
            });
          }}
        />
      </div>
      {error && <p role="alert" className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
    </div>
  );
}
