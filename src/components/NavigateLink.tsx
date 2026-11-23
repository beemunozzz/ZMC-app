"use client";

import { useSyncExternalStore } from "react";
import { navigateUrl } from "@/lib/jobs";

/** iPhone / iPad (newer iPads say "Macintosh" but have a touch screen). */
function isApple() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}
const noop = () => () => {};

/** Driving directions: Apple Maps on iPhones and iPads, Google Maps everywhere else. */
export function NavigateLink({ address, className, children }: { address: string; className?: string; children: React.ReactNode }) {
  const apple = useSyncExternalStore(noop, isApple, () => false);
  const href = apple ? `https://maps.apple.com/?daddr=${encodeURIComponent(address)}&dirflg=d` : navigateUrl(address);
  return (
    <a href={href} target="_blank" rel="noopener" className={className}>
      {children}
    </a>
  );
}
