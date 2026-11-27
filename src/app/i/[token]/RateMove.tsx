"use client";

import { useState, useTransition } from "react";
import { rateMove, type RateResult } from "./actions";

/** "How did we do?" 1-5 stars. 4-5: thank you + Google review link. 1-3: tell us what happened (only Zach sees it). */
export function RateMove({ token, initial, reviewUrl }: { token: string; initial: number | null; reviewUrl: string }) {
  const [stars, setStars] = useState(initial ?? 0);
  const [comment, setComment] = useState("");
  const [res, setRes] = useState<RateResult | null>(initial ? { done: true, reviewUrl: initial >= 4 ? reviewUrl : "" } : null);
  const [pending, start] = useTransition();
  const low = stars > 0 && stars <= 3;

  const send = (n: number, text = "") =>
    start(async () => {
      setRes(await rateMove(token, n, text));
    });

  if (res?.done) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-lg font-bold text-[#15202b]">{stars >= 4 ? "Thank you! We're so glad it went well." : "Thank you for telling us."}</p>
        {stars >= 4 && res.reviewUrl ? (
          <>
            <p className="text-[15px] text-[#3a4652]">Would you share that on Google? It really helps a small local business.</p>
            <a href={res.reviewUrl} target="_blank" rel="noopener" className="press inline-flex h-12 items-center justify-center rounded-xl bg-[#1f4e8c] px-6 text-base font-semibold text-white">
              Leave a Google review
            </a>
          </>
        ) : stars <= 3 ? (
          <p className="text-[15px] text-[#3a4652]">Zach will reach out to make it right.</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-lg font-bold text-[#15202b]">How did we do?</p>
      <div className="flex gap-1" role="radiogroup" aria-label="Rate your move">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={stars === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            disabled={pending}
            onClick={() => {
              setStars(n);
              if (n >= 4) send(n);
            }}
            className="press h-12 w-12 text-4xl leading-none"
            style={{ color: n <= stars ? "#d9a25b" : "#d5cdbf" }}
          >
            ★
          </button>
        ))}
      </div>
      {low && (
        <div className="flex w-full flex-col gap-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="What could we have done better? Only Zach sees this."
            className="rounded-xl border border-[#d5cdbf] bg-white p-3 text-base text-[#15202b] outline-none focus:border-[#1f4e8c]"
          />
          <button type="button" disabled={pending} onClick={() => send(stars, comment)} className="press h-12 rounded-xl bg-[#1f4e8c] font-semibold text-white disabled:opacity-50">
            {pending ? "Sending…" : "Send to Zach"}
          </button>
        </div>
      )}
      {res?.error && <p role="alert" className="text-sm text-[#a33a2b]">{res.error}</p>}
    </div>
  );
}
