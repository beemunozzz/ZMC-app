"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/env";

function friendly(message: string) {
  const m = message.toLowerCase();
  if (m.includes("database error") || m.includes("crew list"))
    return "That email isn't on the ZMC crew list. Ask Zach to add it on the Crew page, then try again.";
  if (m.includes("rate") || m.includes("too many") || m.includes("security purposes"))
    return "Too many tries in a short time. Wait a few minutes, then try again.";
  if (m.includes("expired") || m.includes("invalid"))
    return "That code didn't work. Check the newest email from ZMC Hub, or send a new code.";
  return message;
}

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) return setError(friendly(error.message));
    setStep("code");
  }

  async function checkCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await createClient().auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setBusy(false);
      return setError(friendly(error.message));
    }
    router.replace("/");
    router.refresh();
  }

  const input =
    "h-12 w-full rounded-xl border border-line bg-bg px-4 text-base text-ink outline-none focus:border-primary";
  const button =
    "press flex h-12 w-full items-center justify-center rounded-xl bg-primary font-semibold text-white disabled:opacity-60 dark:text-navy";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-baseline gap-2">
        <span className="font-display text-3xl font-extrabold uppercase text-ink">ZMC</span>
        <span className="font-display text-3xl font-bold uppercase text-muted">Hub</span>
      </div>

      <div className="rise rounded-2xl border border-line bg-card p-6">
        {!supabaseConfigured ? (
          <p className="text-[15px] text-muted">
            The app isn&apos;t connected to its database yet. Add the two Supabase settings in
            Vercel, then redeploy.
          </p>
        ) : step === "email" ? (
          <form onSubmit={sendCode} className="flex flex-col gap-4">
            <div>
              <h1 className="font-display text-2xl font-extrabold uppercase text-ink">Log in</h1>
              <p className="mt-1 text-sm text-muted">We&apos;ll email you a code. No password needed.</p>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
              Email
              <input
                className={input}
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <button className={button} disabled={busy}>
              {busy ? "Sending…" : "Email me a code"}
            </button>
          </form>
        ) : (
          <form onSubmit={checkCode} className="flex flex-col gap-4">
            <div>
              <h1 className="font-display text-2xl font-extrabold uppercase text-ink">Check your email</h1>
              <p className="mt-1 text-sm text-muted">
                We sent a code to <span className="break-all font-medium text-ink">{email}</span>. It
                can take a minute. Check spam too.
              </p>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
              Code
              <input
                className={`${input} tracking-[0.3em] tabular-nums`}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6,10}"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
              />
            </label>
            <button className={button} disabled={busy}>
              {busy ? "Checking…" : "Log in"}
            </button>
            <button
              type="button"
              className="text-sm font-medium text-primary"
              onClick={() => {
                setStep("email");
                setCode("");
                setError("");
              }}
            >
              Use a different email or send a new code
            </button>
          </form>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-[#B3261E]/10 px-4 py-3 text-sm text-[#B3261E] dark:text-[#F2B8B5]">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
