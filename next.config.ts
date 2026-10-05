import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  async redirects() {
    return [
      // First-impression /cycle URLs (and close aliases) → live cycle desk
      {
        source: "/cycle",
        destination: "/dashboard/btc-cycle",
        permanent: true,
      },
      {
        source: "/cycle/:path*",
        destination: "/dashboard/btc-cycle",
        permanent: true,
      },
      // /cycles is the Market cycles hub (do not redirect)
      {
        source: "/btc-cycle",
        destination: "/dashboard/btc-cycle",
        permanent: true,
      },
      {
        source: "/cycle-map",
        destination: "/dashboard/btc-cycle",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
