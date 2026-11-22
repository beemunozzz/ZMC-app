"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/env";

type Mode = "login" | "signup" | "forgot" | "sent";

function friendly(message: string) {
  const m = message.toLowerCase();
  if (m.includes("database error") || m.includes("crew list"))
    return "That email isn't on the ZMC crew list. Ask Zach to add it on the Crew page, then try again.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "You already have a password. Log in instead, or tap “Forgot password”.";
  if (m.includes("invalid login credentials"))
    return "Wrong email or password. Try again, or tap “Forgot password”.";
  if (m.includes("email not confirmed"))
    return "This account still needs its email confirmed. Ask Brandon to check the Supabase email settings.";
  if (m.includes("rate") || m.includes("too many") || m.includes("security purposes"))
    return "Too many tries in a short time. Wait a few minutes, then try again.";
  if (m.includes("password should be") || m.includes("weak"))
    return "Pick a longer password: at least 8 characters.";
  return message;
}

const TITLES: Record<Mode, [string, string]> = {
  login: ["Log in", "Use the email Zach added for you."],
  signup: ["Create your password", "First time here? Use the email Zach added for you, then pick a password."],
  forgot: ["Forgot password", "We'll email you a link to pick a new password."],
  sent: ["Check your email", ""],
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function go(next: Mode) {
    setMode(next);
    setError("");
    setPassword("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();
    const cleanEmail = email.trim().toLowerCase();

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/auth/callback?next=/account/password`,
      });
      setBusy(false);
      if (error) return setError(friendly(error.message));
      return setMode("sent");
    }

    if (mode === "signup" && password.length < 8) {
      setBusy(false);
      return setError("Pick a longer password: at least 8 characters.");
    }

    const { data, error } =
      mode === "signup"
        ? await supabase.auth.signUp({ email: cleanEmail, password })
        : await supabase.auth.signInWithPassword({ email: cleanEmail, password });

    if (error) {
      setBusy(false);
      return setError(friendly(error.message));
    }
    if (mode === "signup" && !data.session) {
      // Supabase still has "Confirm email" turned on, so it sent a confirmation email instead.
      setBusy(false);
      return setMode("sent");
    }
    router.replace("/");
    router.refresh();
  }

  const input =
    "h-12 w-full rounded-xl border border-line bg-bg px-4 text-base text-ink outline-none focus:border-primary";
  const button =
    "press flex h-12 w-full items-center justify-center rounded-xl bg-primary font-semibold text-white disabled:opacity-60 dark:text-navy";
  const link = "text-sm font-medium text-primary";
  const [title, subtitle] = TITLES[mode];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-baseline gap-2">
        <span className="font-display text-3xl font-extrabold uppercase text-ink">ZMC</span>
        <span className="font-display text-3xl font-bold uppercase text-muted">Hub</span>
      </div>

      <div key={mode} className="rise rounded-2xl border border-line bg-card p-6">
        <h1 className="font-display text-2xl font-extrabold uppercase text-ink">{title}</h1>

        {!supabaseConfigured ? (
          <p className="mt-2 text-[15px] text-muted">
            The app isn&apos;t connected to its database yet. Add the two Supabase settings in Vercel, then
            redeploy.
          </p>
        ) : mode === "sent" ? (
          <>
            <p className="mt-2 text-[15px] text-muted">
              We sent an email to <span className="break-all font-medium text-ink">{email}</span>. Open it on
              this phone and tap the link. It can take a minute, so check spam too.
            </p>
            <button type="button" className={`${link} mt-5`} onClick={() => go("login")}>
              Back to log in
            </button>
          </>
        ) : (
          <form onSubmit={submit} className="mt-1 flex flex-col gap-4">
            <p className="text-sm text-muted">{subtitle}</p>
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

            {mode !== "forgot" && (
              <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
                <span className="flex items-center justify-between">
                  {mode === "signup" ? "New password" : "Password"}
                  <button type="button" className="text-xs font-medium text-primary" onClick={() => setShow(!show)}>
                    {show ? "Hide" : "Show"}
                  </button>
                </span>
                <input
                  className={input}
                  type={show ? "text" : "password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                  minLength={mode === "signup" ? 8 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "At least 8 characters" : ""}
                />
              </label>
            )}

            <button className={button} disabled={busy}>
              {busy
                ? "One moment…"
                : mode === "login"
                  ? "Log in"
                  : mode === "signup"
                    ? "Create password and log in"
                    : "Email me a reset link"}
            </button>

            <div className="flex flex-col items-center gap-3 pt-1">
              {mode === "login" ? (
                <>
                  <button type="button" className={link} onClick={() => go("forgot")}>
                    Forgot password?
                  </button>
                  <button type="button" className={link} onClick={() => go("signup")}>
                    First time? Create your password
                  </button>
                </>
              ) : (
                <button type="button" className={link} onClick={() => go("login")}>
                  Back to log in
                </button>
              )}
            </div>
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
