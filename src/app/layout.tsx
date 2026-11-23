import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import "./look-depth.css"; // the "depth" look (shadows, glass header, glowing buttons); on via data-look="depth" below

// One family for everything (Brandon's pick): Archivo. Headlines use its narrow width (see .font-display).
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });

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
    <html lang="en" className={`${archivo.variable} h-full antialiased`} data-look="depth" suppressHydrationWarning>
      <head>
        {/* Apply the saved Light / Dark choice before the page paints, so it never flashes. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("zmc-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
