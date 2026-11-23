"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* press and hold the text to copy instead */
        }
      }}
      className="press h-11 shrink-0 rounded-xl border border-line px-4 text-sm font-semibold text-primary"
    >
      {done ? "Copied ✓" : "Copy"}
    </button>
  );
}
