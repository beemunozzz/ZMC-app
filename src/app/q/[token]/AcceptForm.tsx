"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SignaturePad } from "@/components/SignaturePad";
import { acceptQuote, type AcceptState } from "./actions";

/** "Save as PDF": the phone's own Save/Print, which uses the page's one-page print layout. */
export function SaveButton({ big }: { big?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`press inline-flex items-center justify-center gap-2 rounded-xl font-semibold ${
        big ? "h-12 bg-[#1f4e8c] px-6 text-base text-white" : "h-10 border border-[#d5cdbf] bg-white px-4 text-sm text-[#15202b] shadow-sm"
      }`}
    >
      {big ? "Save your signed estimate (PDF)" : "Save as PDF"}
    </button>
  );
}

const today = () =>
  new Date().toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "long", day: "numeric", year: "numeric" });

/** The customer signs with a finger, types their name, accepts, and books. */
export function AcceptForm({ token, defaultName, nte }: { token: string; defaultName: string; nte: string }) {
  const [state, action, pending] = useActionState<AcceptState, FormData>(acceptQuote, {});
  const [signed, setSigned] = useState(false);
  const [agree, setAgree] = useState(false);
  const [name, setName] = useState(defaultName);
  const ready = signed && agree && !!name.trim();
  const router = useRouter();
  // After booking, reload the page so it shows the signed estimate and the "Save" button.
  useEffect(() => {
    if (state.done) router.refresh();
  }, [state.done, router]);

  if (state.done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-5 text-center shadow-sm">
        <p className="text-2xl font-bold text-[#2f7a4f]">✓ Thank you, you&apos;re booked!</p>
        <p className="text-[15px] text-[#3a4652]">We&apos;ve got your signed estimate and your move is on our schedule.</p>
        <SaveButton big />
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-2xl bg-white p-5 text-[#15202b] shadow-sm">
      <input type="hidden" name="token" value={token} />
      <div>
        <h2 className="text-xl font-bold">Sign and book your move</h2>
        <p className="text-[15px] text-[#5b6672]">Sign with your finger in the box below.</p>
      </div>

      <div className="[&_canvas]:bg-white">
        <SignaturePad name="signature" onChange={setSigned} />
      </div>

      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Your full name
          <input
            name="signed_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className="h-12 rounded-xl border border-[#d5cdbf] bg-white px-3 text-base outline-none focus:border-[#1f4e8c]"
          />
        </label>
        <div className="flex flex-col gap-1 text-sm font-medium">
          Date
          <span className="flex h-12 items-center rounded-xl bg-[#f3f0ea] px-3 text-base">{today()}</span>
        </div>
      </div>

      <label className="flex items-start gap-3 text-[15px]">
        <input type="checkbox" name="agree" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#1f4e8c]" />
        <span>
          I accept this estimate and the not-to-exceed price of <b>{nte}</b>.
        </span>
      </label>

      {state.error && <p role="alert" className="rounded-xl bg-[#fbe9e7] px-3 py-2 text-sm text-[#a33a2b]">{state.error}</p>}

      <button
        disabled={!ready || pending}
        className="press h-14 rounded-xl bg-[#1f4e8c] text-lg font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Booking…" : "Confirm and book"}
      </button>
      {!ready && <p className="-mt-2 text-center text-sm text-[#5b6672]">Sign, check your name, and tick the box to book.</p>}
    </form>
  );
}
