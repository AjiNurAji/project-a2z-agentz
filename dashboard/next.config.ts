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
};

export default nextConfig;
