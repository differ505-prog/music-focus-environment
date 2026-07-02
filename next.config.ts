import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "core-normal.trae.ai",
      },
    ],
  },
};

export default nextConfig;
