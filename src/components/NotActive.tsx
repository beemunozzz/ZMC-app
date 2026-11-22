"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function NotActive() {
  const router = useRouter();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border border-line bg-card p-6">
        <h1 className="font-display text-2xl font-extrabold uppercase text-ink">Account not active</h1>
        <p className="mt-2 text-[15px] text-muted">
          You&apos;re logged in, but you&apos;re not on the active ZMC crew list. Ask Zach to turn your
          account back on.
        </p>
        <button
          className="press mt-6 flex h-12 w-full items-center justify-center rounded-xl border border-line font-semibold text-ink"
          onClick={async () => {
            await createClient().auth.signOut();
            router.replace("/login");
            router.refresh();
          }}
        >
          Log out
        </button>
      </div>
    </main>
  );
}
