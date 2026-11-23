"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type PreviewOption = { id: string; name: string };

export function AppHeader({
  title,
  isOwner,
  name,
  roleLabel,
  newJobHref,
  preview,
}: {
  title: string;
  isOwner: boolean;
  name: string;
  roleLabel: string;
  /** Shows the "+ New job" button (owner only). */
  newJobHref?: string;
  /** "Show jobs for" crew preview in the menu (owner only). */
  preview?: { options: PreviewOption[]; current: string; hrefFor: Record<string, string> };
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const item = "press flex h-12 items-center rounded-xl px-4 text-[15px] font-medium text-ink";
  const section = "px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-muted";

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
        <Link href="/" className="font-display text-xl font-extrabold uppercase tracking-wide text-ink">
          ZMC
        </Link>
        <span className="min-w-0 truncate font-display text-xl font-bold uppercase tracking-wide text-muted">{title}</span>
        <div className="ml-auto flex items-center gap-1">
          {isOwner && newJobHref && (
            <Link
              href={newJobHref}
              className="press flex h-10 items-center rounded-xl bg-primary px-3.5 text-sm font-semibold text-white dark:text-navy"
            >
              + New job
            </Link>
          )}
          <button
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="press flex h-11 w-11 items-center justify-center rounded-xl text-2xl text-ink"
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {open && (
        <nav className="rise mx-auto max-w-6xl px-4 pb-4">
          <div className="ml-auto max-w-sm rounded-2xl border border-line bg-card p-2">
            <p className="px-4 pb-1 pt-2 text-xs text-muted">
              Signed in as <span className="font-semibold text-ink">{name}</span> · {roleLabel}
            </p>
            {isOwner ? (
              <>
                <Link href="/" className={item} onClick={() => setOpen(false)}>
                  Home
                </Link>
                <Link href="/schedule" className={item} onClick={() => setOpen(false)}>
                  Schedule
                </Link>
              </>
            ) : (
              <Link href="/" className={item} onClick={() => setOpen(false)}>
                My jobs
              </Link>
            )}

            {isOwner && preview && (
              <label className="flex flex-col gap-1 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted">
                Show jobs for
                <select
                  className="h-11 rounded-xl border border-line bg-bg px-3 text-[15px] font-medium normal-case tracking-normal text-ink"
                  value={preview.current}
                  onChange={(e) => {
                    setOpen(false);
                    router.push(preview.hrefFor[e.target.value] ?? "/schedule");
                  }}
                >
                  <option value="">Everyone</option>
                  {preview.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {isOwner && (
              <>
                <p className={section}>Business</p>
                <Link href="/quotes" className={item} onClick={() => setOpen(false)}>
                  Quotes
                </Link>
                <Link href="/invoices" className={item} onClick={() => setOpen(false)}>
                  Invoices
                </Link>
                <Link href="/settings" className={item} onClick={() => setOpen(false)}>
                  Prices
                </Link>
                <p className={section}>Team</p>
                <Link href="/team" className={item} onClick={() => setOpen(false)}>
                  Crew members
                </Link>
                <Link href="/payroll" className={item} onClick={() => setOpen(false)}>
                  Payroll
                </Link>
              </>
            )}
            <div className="my-2 border-t border-line" />
            {!isOwner && (
              <Link href="/availability" className={item} onClick={() => setOpen(false)}>
                My time off
              </Link>
            )}
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
