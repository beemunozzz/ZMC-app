// The app's own web address (for links in texts), from the request. Server only.
import { headers } from "next/headers";

export async function siteUrl() {
  const h = await headers();
  return `https://${h.get("x-forwarded-host") ?? h.get("host") ?? "zmc-app.vercel.app"}`;
}
