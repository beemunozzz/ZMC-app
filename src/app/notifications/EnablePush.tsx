"use client";

import { useEffect, useState } from "react";
import { InstallApp } from "@/components/InstallApp";
import { Switch } from "@/components/Toggle";
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
      setMsg(r.error ? r : {});
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
      setMsg({});
    } finally {
      setBusy(false);
    }
  }

  const on = status === "on";
  const canToggle = (status === "on" || status === "off") && !!publicKey;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      {/* One switch, same spot every time */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold text-ink">Pop-up notifications</h2>
          <p className="text-sm text-muted">
            {status === "checking"
              ? "Checking…"
              : on
                ? "On for this phone"
                : status === "off" && publicKey
                  ? "Off"
                  : status === "off"
                    ? "Not switched on for the app yet"
                    : "Not available yet"}
          </p>
        </div>
        <Switch on={on} label="Pop-up notifications" disabled={busy || !canToggle} onClick={on ? turnOff : turnOn} />
      </div>
      <p className="-mt-1 text-sm text-muted">
        Banners on your lock screen, like a text message, even when the app is closed: new jobs, changes, and the night-before reminder.
      </p>

      {status === "ios-needs-install" && (
        <div className="flex flex-col gap-2 rounded-xl bg-bg p-3">
          <p className="text-[15px] text-ink">
            <b>On iPhone, first add ZMC Hub to your home screen</b>, then open it from the home screen icon and come back here.
          </p>
          <InstallApp compact />
        </div>
      )}

      {status === "unsupported" && <p className="text-sm text-muted">This browser can&apos;t get notifications. Use Safari on iPhone (from the home screen) or Chrome on Android.</p>}

      {status === "blocked" && (
        <p className="text-sm text-muted">
          Blocked on this phone. Turn them back on in <b>Settings → Notifications → ZMC Hub</b> (Android: the lock icon next to the web address → Notifications), then reload.
        </p>
      )}

      {status === "off" && !publicKey && (
        <p className="text-sm text-muted">The switch starts working once Zach (or Brandon) finishes the one-time notifications setup. Nothing to do on your phone until then.</p>
      )}

      {on && (
        <button
          type="button"
          onClick={async () => {
            setBusy(true);
            setMsg(await sendTest());
            setBusy(false);
          }}
          disabled={busy}
          className="self-start text-sm font-semibold text-primary"
        >
          Send me a test
        </button>
      )}

      {msg.error && <p role="alert" className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{msg.error}</p>}
      {msg.ok && <p className="rounded-xl bg-ok/12 px-3 py-2 text-sm font-medium text-ok">✓ {msg.ok}</p>}
    </section>
  );
}
