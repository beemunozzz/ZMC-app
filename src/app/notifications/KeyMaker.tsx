"use client";

import { useState } from "react";

const b64url = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/**
 * One-time setup (owner only): makes the notification key pair right here in the browser.
 * Nothing is sent anywhere. The owner pastes the two keys into Vercel himself.
 */
export function KeyMaker() {
  const [keys, setKeys] = useState<{ pub: string; priv: string } | null>(null);
  const [copied, setCopied] = useState("");

  async function make() {
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const pub = b64url(await crypto.subtle.exportKey("raw", pair.publicKey));
    const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
    setKeys({ pub, priv: jwk.d ?? "" });
  }
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
        Notifications need two keys saved in Vercel. This makes them on your phone. Nothing is sent anywhere. Do this <b>once</b>.
      </p>
      {!keys ? (
        <button type="button" onClick={make} className="press h-12 rounded-xl bg-primary font-semibold text-white dark:text-navy">
          Make the two keys
        </button>
      ) : (
        <>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink">
            <li>
              Open <b>vercel.com</b> → <b>zmc-app</b> → <b>Settings</b> → <b>Environment Variables</b>.
            </li>
            <li>Add the first key below as <b>Config</b>, and the second as <b>Secret</b>. Leave all environments ticked.</li>
            <li>
              Tell Claude &ldquo;keys added&rdquo;. It will republish the app so they take effect, then you can turn on notifications above.
            </li>
          </ol>
          {row("1 of 2", "VAPID_PUBLIC_KEY", keys.pub, "Config", "pub")}
          {row("2 of 2", "VAPID_PRIVATE_KEY", keys.priv, "Secret", "priv")}
          <p className="text-xs text-muted">
            Keep the second one private: don&apos;t text or email it. Leaving this page forgets both keys, so if you lose them before saving, just make new ones.
          </p>
        </>
      )}
    </section>
  );
}
