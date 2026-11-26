import type { Metadata, Viewport } from "next";
import { Archivo, Gelasio } from "next/font/google";
import { Suspense } from "react";
import { DevBar } from "@/components/dev/DevBar";
import "./globals.css";
import "./look-depth.css"; // the "depth" look (shadows, glass header, glowing buttons); on via data-look="depth" below

// One family for everything (Brandon's pick): Archivo. Headlines use its narrow width (see .font-display).
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });
// The ZMC logo is Georgia. Gelasio (a free look-alike of Georgia) stands in on phones without Georgia, like Android.
const gelasio = Gelasio({ variable: "--font-gelasio", subsets: ["latin"], weight: "700" });

export const metadata: Metadata = {
  title: "ZMC Hub",
  description: "Jobs, crew and invoices for Zachery's Moving Co.",
  applicationName: "ZMC Hub",
  appleWebApp: { capable: true, title: "ZMC Hub", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f0ea" },
    { media: "(prefers-color-scheme: dark)", color: "#12171d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${gelasio.variable} h-full antialiased`} data-look="depth" suppressHydrationWarning>
      <head>
        {/* Apply the saved Light / Dark choice before the page paints, so it never flashes. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("zmc-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {/* Developer "View as" bar (only Brandon sees it) */}
        <Suspense fallback={null}>
          <DevBar />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
