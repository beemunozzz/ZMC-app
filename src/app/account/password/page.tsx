"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Pick a longer password: at least 8 characters.");
    setBusy(true);
    setError("");
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) {
      return setError(
        error.message.toLowerCase().includes("session")
          ? "This page needs you to be logged in. Use “Forgot password” on the log in page to get a new link."
          : error.message.toLowerCase().includes("different")
            ? "That's your current password. Pick a new one."
            : error.message,
      );
    }
    setDone(true);
    setTimeout(() => {
      router.replace("/");
      router.refresh();
    }, 1200);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <div className="mb-8 flex flex-col items-center gap-2">
        <span className="font-logo text-6xl text-ink">ZMC</span>
        <span className="h-1.5 w-16 rounded-full bg-tape" aria-hidden />
      </div>
      <div className="rise rounded-2xl border border-line bg-card p-6">
        <h1 className="font-display text-2xl font-extrabold uppercase text-ink">New password</h1>
        {done ? (
          <p className="mt-3 text-[15px] font-medium text-[#2F6B45] dark:text-[#8FD3A6]">✓ Password saved. Taking you in…</p>
        ) : (
          <form onSubmit={save} className="mt-3 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
              <span className="flex items-center justify-between">
                New password
                <button type="button" className="text-xs font-medium text-primary" onClick={() => setShow(!show)}>
                  {show ? "Hide" : "Show"}
                </button>
              </span>
              <input
                className="h-12 w-full rounded-xl border border-line bg-bg px-4 text-base text-ink outline-none focus:border-primary"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </label>
            <button
              disabled={busy}
              className="press flex h-12 w-full items-center justify-center rounded-xl bg-primary font-semibold text-white disabled:opacity-60 dark:text-navy"
            >
              {busy ? "Saving…" : "Save password"}
            </button>
            <button type="button" className="text-sm font-medium text-primary" onClick={() => router.replace("/")}>
              Cancel
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
