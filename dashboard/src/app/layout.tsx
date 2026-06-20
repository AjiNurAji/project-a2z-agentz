import type { Metadata } from "next";
import { Inter, IBM_Plex_Serif, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import PWARegister from "@/components/ui/PWARegister";
import { RouteProgress } from "@/components/ui/RouteProgress";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const ibmPlexSerif = IBM_Plex_Serif({
  variable: "--font-ibm-plex-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "A2Z Agent — Autonomous Web3 Scavenger Dashboard",
  description:
    "Multi-agent AI dashboard for autonomous airdrop discovery and Agent-to-Agent payments on Base Network, powered by AMD MI300X & Llama 3.",
  metadataBase: new URL("https://a2z-agent.vercel.app"),
  keywords: ["web3", "ai agent", "airdrop", "base network", "autonomous"],
  openGraph: {
    title: "A2Z Agent — Autonomous Web3 Scavenger Dashboard",
    description:
      "Multi-agent AI dashboard for autonomous airdrop discovery and Agent-to-Agent payments on Base Network, powered by AMD MI300X & Llama 3.",
    url: "https://a2z-agent.vercel.app",
    siteName: "A2Z Agent",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "A2Z Agent — Autonomous Web3 Scavenger Dashboard",
    description:
      "Multi-agent AI dashboard for autonomous airdrop discovery and Agent-to-Agent payments on Base Network, powered by AMD MI300X & Llama 3.",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${ibmPlexSerif.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('a2z-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}else{var isDark=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.setAttribute('data-theme',isDark?'dark':'light')}}catch(e){}})()` }} />
      </head>
      <body
        className="flex h-screen overflow-hidden font-sans"
        style={{ backgroundColor: "var(--color-surface)", color: "var(--color-body)", transition: "background-color 0.3s ease, color 0.3s ease" }}
        suppressHydrationWarning
      >
        <PWARegister />
        <ToastProvider>
          <RouteProgress />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
