"use client";

import { useEffect, useState } from "react";

type Platform = "ios" | "android" | "other";
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

function detect(): { platform: Platform; installed: boolean; safari: boolean } {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const safari = ios && !/CriOS|FxiOS|EdgiOS/i.test(ua);
  return { platform: ios ? "ios" : android ? "android" : "other", installed, safari };
}

/** The iPhone "Share" icon (a box with an arrow), drawn so it looks like the button they need to find. */
function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="inline h-5 w-5 -translate-y-0.5 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Share">
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </svg>
  );
}

const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <li className="flex gap-3">
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white dark:text-navy">{n}</span>
    <span className="pt-0.5 text-[15px] text-ink">{children}</span>
  </li>
);

/**
 * "Add ZMC Hub to your home screen": one button on Android (when the browser allows it),
 * step-by-step on iPhone (Apple doesn't allow a button). Already installed: says so.
 */
export function InstallApp({ compact }: { compact?: boolean }) {
  const [env, setEnv] = useState<ReturnType<typeof detect> | null>(null);
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [added, setAdded] = useState(false);
  const [tab, setTab] = useState<Platform | null>(null);

  useEffect(() => {
    // Read the device once, after the page loads (the server can't know it).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnv(detect());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallEvent);
    };
    const onInstalled = () => setAdded(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!env) return <div className="h-24" aria-hidden />;
  if (env.installed || added) {
    return <p className="rounded-xl bg-ok/12 px-3 py-3 text-[15px] font-medium text-ok">✓ ZMC Hub is on your home screen. Open it from there from now on.</p>;
  }

  const show = tab ?? (env.platform === "other" ? "ios" : env.platform);
  return (
    <div className="flex flex-col gap-3">
      {!compact && (
        <p className="text-[15px] text-muted">
          It works like a real app: its own icon, full screen, and on iPhone it&apos;s needed for notifications.
        </p>
      )}

      {prompt && (
        <button
          type="button"
          onClick={async () => {
            await prompt.prompt();
            const choice = await prompt.userChoice;
            if (choice.outcome === "accepted") setAdded(true);
            setPrompt(null);
          }}
          className="press flex h-12 items-center justify-center rounded-xl bg-primary font-semibold text-white dark:text-navy"
        >
          Add to home screen
        </button>
      )}

      {env.platform === "other" && (
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-bg p-1">
          {(["ios", "android"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setTab(p)}
              className={`press h-9 rounded-lg text-sm font-semibold ${show === p ? "bg-card text-ink shadow-sm" : "text-muted"}`}
            >
              {p === "ios" ? "iPhone" : "Android"}
            </button>
          ))}
        </div>
      )}

      {show === "ios" ? (
        <ol className="flex flex-col gap-3">
          {env.platform === "ios" && !env.safari && (
            <li className="rounded-xl bg-warn/12 px-3 py-2 text-sm text-warn">Tip: this works best in Safari. Open this page in Safari if you don&apos;t see the steps below.</li>
          )}
          <Step n={1}>
            Tap the <b>Share</b> button <ShareIcon /> (bottom of the screen in Safari, or top right in Chrome).
          </Step>
          <Step n={2}>
            Scroll down and tap <b>Add to Home Screen</b>.
          </Step>
          <Step n={3}>
            Tap <b>Add</b> (top right). The ZMC icon shows up on your home screen.
          </Step>
        </ol>
      ) : (
        !prompt && (
          <ol className="flex flex-col gap-3">
            <Step n={1}>
              Tap the <b>⋮</b> menu (top right in Chrome).
            </Step>
            <Step n={2}>
              Tap <b>Add to Home screen</b> (or <b>Install app</b>).
            </Step>
            <Step n={3}>
              Tap <b>Install</b> or <b>Add</b>. The ZMC icon shows up on your home screen.
            </Step>
          </ol>
        )
      )}
    </div>
  );
}
