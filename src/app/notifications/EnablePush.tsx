"use client";

import { useEffect, useState } from "react";
import { removePhone, savePhone, sendTest } from "./actions";

type Status = "checking" | "unsupported" | "ios-needs-install" | "blocked" | "off" | "on";

function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function deviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad|Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return "iPad";
  if (/Android/.test(ua)) return "Android phone";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows computer";
  return "This device";
}

export function EnablePush({ publicKey }: { publicKey: string }) {
  const [status, setStatus] = useState<Status>("checking");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [busy, setBusy] = useState(false);
  const [endpoint, setEndpoint] = useState("");

  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setStatus(ios && !standalone ? "ios-needs-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setStatus("blocked");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      if (sub) setEndpoint(sub.endpoint);
      setStatus(sub && Notification.permission === "granted" ? "on" : "off");
    })().catch(() => setStatus("unsupported"));
  }, []);

  async function turnOn() {
    setBusy(true);
    setMsg({});
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus(perm === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) }));
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const r = await savePhone(json, deviceName());
      setMsg(r);
      if (!r.error) {
        setEndpoint(sub.endpoint);
        setStatus("on");
      }
    } catch (e) {
      setMsg({ error: `Couldn't turn on notifications: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      await sub?.unsubscribe();
      await removePhone(endpoint || sub?.endpoint || "");
      setStatus("off");
      setMsg({ ok: "Notifications are off for this phone." });
    } finally {
      setBusy(false);
    }
  }

  const btn = "press flex h-14 w-full items-center justify-center rounded-xl text-lg font-semibold disabled:opacity-60";

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <h2 className="font-display text-lg font-extrabold uppercase text-ink">This phone</h2>

      {status === "checking" && <p className="text-sm text-muted">Checking…</p>}

      {status === "ios-needs-install" && (
        <div className="flex flex-col gap-2 text-[15px] text-ink">
          <p>
            <b>On iPhone, add ZMC Hub to your home screen first.</b> Then open it from there and come back to this page.
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Tap the <b>Share</b> button (the square with an arrow, at the bottom of Safari).
            </li>
            <li>
              Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.
            </li>
            <li>
              Open <b>ZMC Hub</b> from your home screen, go to ☰ → <b>Notifications</b>, and tap <b>Turn on notifications</b>.
            </li>
          </ol>
          <p className="text-sm text-muted">Needs iOS 16.4 or newer.</p>
        </div>
      )}

      {status === "unsupported" && <p className="text-[15px] text-ink">This browser can&apos;t get notifications. Try Safari on iPhone (from the home screen) or Chrome on Android.</p>}

      {status === "blocked" && (
        <p className="text-[15px] text-ink">
          Notifications are blocked for ZMC Hub. Turn them back on in your phone&apos;s <b>Settings → Notifications → ZMC Hub</b> (on Android: the lock icon next to the web
          address → Notifications), then reload this page.
        </p>
      )}

      {status === "off" && (
        <>
          <p className="text-[15px] text-muted">Get a buzz when you&apos;re put on a job, a job changes, or something needs you.</p>
          <button onClick={turnOn} disabled={busy || !publicKey} className={`${btn} bg-primary text-white dark:text-navy`}>
            {busy ? "Turning on…" : "Turn on notifications"}
          </button>
          {!publicKey && <p className="text-sm text-warn">Notifications aren&apos;t set up yet. See the steps below.</p>}
        </>
      )}

      {status === "on" && (
        <>
          <p className="text-[15px] font-semibold text-ok">✓ Notifications are on for this phone.</p>
          <button
            onClick={async () => {
              setBusy(true);
              setMsg(await sendTest());
              setBusy(false);
            }}
            disabled={busy}
            className={`${btn} border border-line text-ink`}
          >
            Send me a test
          </button>
          <button onClick={turnOff} disabled={busy} className="self-start text-sm font-semibold text-muted">
            Turn off for this phone
          </button>
        </>
      )}

      {msg.error && <p role="alert" className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{msg.error}</p>}
      {msg.ok && <p className="rounded-xl bg-ok/12 px-3 py-2 text-sm font-medium text-ok">✓ {msg.ok}</p>}
    </section>
  );
}
