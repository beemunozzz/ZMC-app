import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // The quote PDF maker runs on the server and needs its font files.
  serverExternalPackages: ["@react-pdf/renderer"],
  outputFileTracingIncludes: { "/q/[token]/pdf": ["./src/assets/fonts/**"] },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
