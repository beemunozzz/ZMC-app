"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AppHeader({
  title,
  isOwner,
  name,
  roleLabel,
}: {
  title: string;
  isOwner: boolean;
  name: string;
  roleLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const item = "press flex h-12 items-center rounded-xl px-4 text-[15px] font-medium text-ink";

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
        <Link href="/" className="font-display text-xl font-extrabold uppercase tracking-wide text-ink">
          ZMC
        </Link>
        <span className="truncate font-display text-xl font-bold uppercase tracking-wide text-muted">
          {title}
        </span>
        <button
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="press ml-auto flex h-11 w-11 items-center justify-center rounded-xl text-2xl text-ink"
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      {open && (
        <nav className="rise mx-auto max-w-3xl px-4 pb-4">
          <div className="rounded-2xl border border-line bg-card p-2">
            <p className="px-4 pb-1 pt-2 text-xs text-muted">
              Signed in as <span className="font-semibold text-ink">{name}</span> · {roleLabel}
            </p>
            <Link href="/" className={item} onClick={() => setOpen(false)}>
              Home
            </Link>
            {isOwner && (
              <>
                <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-muted">Team</p>
                <Link href="/team" className={item} onClick={() => setOpen(false)}>
                  Crew members
                </Link>
              </>
            )}
            <div className="my-2 border-t border-line" />
            <Link href="/account/password" className={item} onClick={() => setOpen(false)}>
              Change password
            </Link>
            <button onClick={signOut} className={`${item} w-full text-left`}>
              Log out
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
