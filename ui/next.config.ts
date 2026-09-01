import type { NextConfig } from "next";

// Both flavors: BUILD_TARGET=export builds the static export the Cloudflare
// gateway serves; the default build is standalone SSR for AWS/dev.
const nextConfig: NextConfig =
  process.env.BUILD_TARGET === "export"
    ? { output: "export", images: { unoptimized: true } }
    : {
        output: "standalone",
        images: {
          remotePatterns: [
            { protocol: "https", hostname: "i.pravatar.cc" },
            { protocol: "https", hostname: "images.unsplash.com" },
          ],
        },
      };

export default nextConfig;
