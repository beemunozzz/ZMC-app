"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Profile } from "@/lib/setup";
import { SHIRT_SIZES, SHOE_SIZES } from "@/lib/setup";
import { saveMyInfo, type InfoState } from "./actions";

const input = "block h-12 w-full min-w-0 rounded-xl border border-line bg-bg px-3 text-base text-ink outline-none focus:border-primary";
const label = "flex min-w-0 flex-col gap-1.5 text-sm font-medium text-ink";
const card = "flex flex-col gap-3 rounded-2xl border border-line bg-card p-4";
const heading = "font-display text-lg font-extrabold uppercase text-ink";
const chip = (on: boolean) =>
  `press flex h-12 cursor-pointer items-center justify-center rounded-xl border text-[15px] font-semibold ${
    on ? "border-primary bg-primary/10 text-ink" : "border-line text-ink"
  }`;

export function InfoForm({
  phone,
  profile,
  name,
  email,
  next,
}: {
  phone: string;
  profile: Profile | null;
  name: string;
  email: string | null;
  /** In the welcome walkthrough: where to go after saving. */
  next?: string;
}) {
  const [state, action, pending] = useActionState<InfoState, FormData>(saveMyInfo, {});
  const [lic, setLic] = useState(profile?.has_license == null ? "" : profile.has_license ? "yes" : "no");
  const [shirt, setShirt] = useState(profile?.shirt_size ?? "");

  return (
    <form action={action} className="flex flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      <section className={card}>
        <h2 className={heading}>About you</h2>
        <div className="grid gap-1 rounded-xl bg-bg px-3 py-2 text-sm">
          <p>
            <span className="text-muted">Name:</span> <b className="text-ink">{name}</b>
          </p>
          {email && (
            <p className="break-all">
              <span className="text-muted">Email (your login):</span> <span className="text-ink">{email}</span>
            </p>
          )}
          <p className="text-xs text-muted">Name spelled wrong? Ask Zach to fix it.</p>
        </div>
        <label className={label}>
          <span>Date of birth</span>
          <input name="birth_date" type="date" defaultValue={profile?.birth_date ?? ""} max={new Date().toISOString().slice(0, 10)} className={input} />
          <span className="text-xs font-normal text-muted">So we can celebrate your birthday. The crew only sees the day, never your age.</span>
        </label>
        <label className={label}>
          <span>Cell phone</span>
          <input name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={phone} placeholder="(209) 555-0100" className={input} />
        </label>
        <label className={label}>
          <span>Home address</span>
          <input name="address" autoComplete="street-address" defaultValue={profile?.address ?? ""} placeholder="Street, city" className={input} />
        </label>
      </section>

      <section className={card}>
        <h2 className={heading}>Emergency contact</h2>
        <p className="-mt-1 text-sm text-muted">Who should Zach call if you get hurt on a job?</p>
        <label className={label}>
          <span>Name</span>
          <input name="emergency_name" autoComplete="off" defaultValue={profile?.emergency_name ?? ""} className={input} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            <span>Relationship</span>
            <input name="emergency_relation" autoComplete="off" defaultValue={profile?.emergency_relation ?? ""} placeholder="e.g. Mom" className={input} />
          </label>
          <label className={label}>
            <span>Phone</span>
            <input name="emergency_phone" type="tel" inputMode="tel" autoComplete="off" defaultValue={profile?.emergency_phone ?? ""} className={input} />
          </label>
        </div>
      </section>

      <section id="extra" className={`${card} scroll-mt-20`}>
        <h2 className={heading}>License and sizes</h2>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium text-ink">Do you have a valid driver&apos;s license?</legend>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["yes", "Yes"],
                ["no", "No"],
              ] as const
            ).map(([v, l]) => (
              <label key={v} className={chip(lic === v)}>
                <input type="radio" name="has_license" value={v} checked={lic === v} onChange={() => setLic(v)} className="sr-only" />
                {l}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium text-ink">T-shirt size</legend>
          <div className="grid grid-cols-4 gap-2">
            {SHIRT_SIZES.map((s) => (
              <label key={s} className={chip(shirt === s)}>
                <input type="radio" name="shirt_size" value={s} checked={shirt === s} onChange={() => setShirt(s)} className="sr-only" />
                {s}
              </label>
            ))}
          </div>
        </fieldset>
        <label className={label}>
          <span>Shoe size (US, for work boots)</span>
          <select name="shoe_size" defaultValue={profile?.shoe_size ?? ""} className={input}>
            <option value="">Choose your size</option>
            {SHOE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </section>

      <p className="text-sm text-muted">Only you and Zach can see this.</p>
      {state.error && <p role="alert" className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{state.error}</p>}
      {state.ok && (
        <p className="rounded-xl bg-ok/12 px-3 py-2 text-sm font-medium text-ok">
          ✓ {state.ok}{" "}
          <Link href="/" className="underline">
            Back to home
          </Link>
        </p>
      )}
      <button disabled={pending} className="press h-12 rounded-xl bg-primary font-semibold text-white disabled:opacity-60 dark:text-navy">
        {pending ? "Saving…" : next ? "Save and continue" : "Save"}
      </button>
    </form>
  );
}
