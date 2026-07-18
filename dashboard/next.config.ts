import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // RainbowKit/Wagmi pull in @coinbase/cdp-sdk / @base-org/account which rely
  // on Node built-ins (crypto, stream) that break the Next bundler. Treat
  // them as external server packages so they are not bundled/transpiled.
  serverExternalPackages: [
    "@coinbase/cdp-sdk",
    "@base-org/account",
    "@walletconnect/ethereum-provider",
  ],
  // Trust the Cloudflare Quick Tunnel origin so the dev server (next dev)
  // stops blocking cross-origin requests coming through the tunnel domain.
  // The tunnel exposes the app on its HTTPS host; we also allow the :3000 dev
  // port variant in case the forwarded Origin includes it.
  allowedDevOrigins: [
    "harold-occasion-qualities-plasma.trycloudflare.com",
    "harold-occasion-qualities-plasma.trycloudflare.com:3000",
  ],
  // NOTE: Vercel edge cannot resolve the Railway `.up.railway.app` hostname
  // inside rewrites (DNS_HOSTNAME_NOT_FOUND → 502). The dashboard calls the
  // backend DIRECTLY via apiFetch (absolute Railway URL, CORS-approved for
  // archbusins.web.id). Rewrites are intentionally disabled.
};

export default nextConfig;
