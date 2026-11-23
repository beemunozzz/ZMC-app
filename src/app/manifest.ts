import type { MetadataRoute } from "next";

// Lets the app be added to a phone's home screen and opened full-screen like a real app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ZMC Hub",
    short_name: "ZMC",
    description: "Jobs, crew and invoices for Zachery's Moving Co.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0f1b2a",
    theme_color: "#0f1b2a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
