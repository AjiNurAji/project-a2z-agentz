import type { Metadata } from "next";
import { Inter, IBM_Plex_Serif, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DashboardProvider } from "@/components/DashboardContext";
import { ToastProvider } from "@/components/ui/Toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { KeyboardNavWrapper } from "@/components/ui/KeyboardNavWrapper";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import PWARegister from "@/components/ui/PWARegister";
import SkipToContent from "@/components/ui/SkipToContent";
import ScrollToTop from "@/components/ui/ScrollToTop";
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

import { KeyboardHelpOverlay } from "@/components/ui/KeyboardHelpOverlay";
import { OnboardingTour } from "@/components/ui/OnboardingTour";

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
        <SkipToContent />
        <DashboardProvider>
          <ToastProvider>
            <KeyboardNavWrapper>
              <RouteProgress />
              <CommandPalette />
              <KeyboardHelpOverlay />
              <OnboardingTour />
              <Sidebar />
              <div className="flex flex-col flex-1 overflow-hidden min-w-0">
                <Navbar />
                <main className="flex-1 overflow-y-auto relative" id="main-content">
                  <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
                    <div
                      className="absolute top-[-15%] right-[5%] w-[35%] h-[35%] rounded-full blur-[140px] opacity-7 mesh-blob-1"
                      style={{ backgroundColor: "var(--color-brand)" }}
                    />
                    <div
                      className="absolute bottom-[-10%] left-[20%] w-[30%] h-[30%] rounded-full blur-[120px] opacity-7 mesh-blob-2"
                      style={{ backgroundColor: "var(--color-accent-purple)" }}
                    />
                  </div>
                  <div className="relative z-10 p-4 md:p-6 lg:p-8">
                    <ErrorBoundary section="Page">
                      {children}
                    </ErrorBoundary>
                    <ScrollToTop />
                  </div>
                </main>
              </div>
            </KeyboardNavWrapper>
          </ToastProvider>
        </DashboardProvider>
      </body>
    </html>
  );
}
