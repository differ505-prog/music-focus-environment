import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.31.15"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "core-normal.trae.ai",
      },
    ],
  },
};

export default nextConfig;
