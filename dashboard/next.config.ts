import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Trust the Cloudflare Quick Tunnel origin so the dev server (next dev)
  // stops blocking cross-origin requests coming through the tunnel domain.
  // The tunnel exposes the app on its HTTPS host; we also allow the :3000 dev
  // port variant in case the forwarded Origin includes it.
  allowedDevOrigins: [
    "harold-occasion-qualities-plasma.trycloudflare.com",
    "harold-occasion-qualities-plasma.trycloudflare.com:3000",
  ],
  // Proxy /api/* to the Railway backend so the dashboard can call backend
  // routes (e.g. /api/holdings) same-origin without CORS or NEXT_PUBLIC_API_URL.
  // Override target via NEXT_PUBLIC_API_URL at build time if needed.
  async rewrites() {
    const target =
      process.env.NEXT_PUBLIC_API_URL ||
      "https://project-a2z-agentz-production-dc3d.up.railway.app";
    return [
      {
        source: "/api/:path*",
        destination: `${target}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
