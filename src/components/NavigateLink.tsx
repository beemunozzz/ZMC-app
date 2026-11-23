"use client";

import { useSyncExternalStore } from "react";
import { navigateUrl } from "@/lib/jobs";

type Platform = "apple" | "android" | "computer";

function detect(): Platform {
  const ua = navigator.userAgent;
  // Newer iPads say "Macintosh" but have a touch screen.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "apple";
  if (/Android/.test(ua)) return "android";
  return "computer";
}
const noop = () => () => {};

/**
 * Driving directions in the phone's own map app:
 * - iPhone/iPad: the maps:// link always opens the Apple Maps app (a normal web link can open in Safari instead).
 * - Android: the Google Maps link opens the Google Maps app when it's opened in place (not in a new tab).
 * - Computer: Google Maps in a new browser tab.
 */
export function NavigateLink({ address, className, children }: { address: string; className?: string; children: React.ReactNode }) {
  const platform = useSyncExternalStore(noop, detect, () => "computer" as Platform);
  const a = encodeURIComponent(address);
  if (platform === "apple") {
    return (
      <a href={`maps://?daddr=${a}&dirflg=d`} className={className}>
        {children}
      </a>
    );
  }
  if (platform === "android") {
    return (
      <a href={navigateUrl(address)} className={className}>
        {children}
      </a>
    );
  }
  return (
    <a href={navigateUrl(address)} target="_blank" rel="noopener" className={className}>
      {children}
    </a>
  );
}
