import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  async rewrites() {
    return [
      {
        source: "/btc-cycle-map.html",
        destination: "/api/btc-cycle-map",
      },
    ];
  },
};

export default nextConfig;
