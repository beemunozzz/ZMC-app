"use client";

import { useState } from "react";
import { saveTimerKeyHash } from "./actions";

const b64url = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");

/**
 * One-time setup (owner only): makes the keys right here in the browser. Nothing secret is sent anywhere.
 * The owner pastes them into Vercel himself. For the nightly reminder, only a fingerprint (hash) of
 * its key is saved in the database, so the app can check the timer is really Vercel's.
 */
export function KeyMaker({ needPush, needTimer }: { needPush: boolean; needTimer: boolean }) {
  const [keys, setKeys] = useState<{ pub: string; priv: string; timer: string } | null>(null);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");

  async function make() {
    setError("");
    let pub = "",
      priv = "",
      timer = "";
    if (needPush) {
      const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
      pub = b64url(await crypto.subtle.exportKey("raw", pair.publicKey));
      priv = (await crypto.subtle.exportKey("jwk", pair.privateKey)).d ?? "";
    }
    if (needTimer) {
      timer = hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
      const r = await saveTimerKeyHash(hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(timer))));
      if (r.error) return setError(r.error);
    }
    setKeys({ pub, priv, timer });
  }
  const list = [
    ...(needPush
      ? [
          { keyName: "VAPID_PUBLIC_KEY", value: keys?.pub ?? "", type: "Config", what: "pub" },
          { keyName: "VAPID_PRIVATE_KEY", value: keys?.priv ?? "", type: "Secret", what: "priv" },
        ]
      : []),
    ...(needTimer ? [{ keyName: "CRON_SECRET", value: keys?.timer ?? "", type: "Secret", what: "timer" }] : []),
  ];
  const n = list.length;
  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      /* press and hold to copy instead */
    }
  }

  const row = (label: string, keyName: string, value: string, type: string, what: string) => (
    <div className="flex flex-col gap-1 rounded-xl bg-bg p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">
        {label} · type: <span className="text-ink">{type}</span>
      </p>
      <p className="text-sm text-ink">
        Key: <code className="select-all font-semibold">{keyName}</code>
      </p>
      <p className="break-all font-mono text-xs text-ink select-all">{value}</p>
      <button type="button" onClick={() => copy(value, what)} className="press mt-1 h-10 self-start rounded-xl border border-line px-4 text-sm font-semibold text-primary">
        {copied === what ? "Copied ✓" : "Copy value"}
      </button>
    </div>
  );

  return (
    <section className="flex flex-col gap-3 rounded-2xl border-2 border-warn/40 bg-card p-4">
      <h2 className="font-display text-lg font-extrabold uppercase text-ink">One-time setup (owner)</h2>
      <p className="text-sm text-ink">
        {needPush ? "Notifications" : "The night-before reminders"} need {n === 1 ? "a key" : `${n} keys`} saved in Vercel. This makes{" "}
        {n === 1 ? "it" : "them"} on your phone. Do this <b>once</b>.
      </p>
      {error && <p role="alert" className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
      {!keys ? (
        <button type="button" onClick={make} className="press h-12 rounded-xl bg-primary font-semibold text-white dark:text-navy">
          Make the {n === 1 ? "key" : `${n} keys`}
        </button>
      ) : (
        <>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink">
            <li>
              Open <b>vercel.com</b> → <b>zmc-app</b> → <b>Settings</b> → <b>Environment Variables</b>.
            </li>
            <li>
              Add each key below with the type shown (<b>Config</b> or <b>Secret</b>). Leave all environments ticked.
            </li>
            <li>
              Tell Claude &ldquo;keys added&rdquo;. It will republish the app so they take effect, then you can turn on notifications above.
            </li>
          </ol>
          {list.map((k, i) => (
            <div key={k.what}>{row(`${i + 1} of ${n}`, k.keyName, k.value, k.type, k.what)}</div>
          ))}
          <p className="text-xs text-muted">
            Keep the Secret ones private: don&apos;t text or email them. Leaving this page forgets the keys, so if you lose them before saving, just make new ones.
          </p>
        </>
      )}
    </section>
  );
}
