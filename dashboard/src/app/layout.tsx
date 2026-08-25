import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, IBM_Plex_Serif, Geist_Mono } from "next/font/google";
import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthProvider } from "@/components/AuthProvider";
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
  title: "A2Z Agentz — Autonomous DeFi Trading Agent",
  description:
    "Multi-agent AI dashboard for autonomous DeFi trading on Base Network, powered by cloud GPU inference.",
  metadataBase: new URL("https://a2z-agent.vercel.app"),
  keywords: ["web3", "ai agent", "defi", "base network", "autonomous trading"],
  openGraph: {
    title: "A2Z Agentz — Autonomous DeFi Trading Agent",
    description:
      "Multi-agent AI dashboard for autonomous DeFi trading on Base Network, powered by cloud GPU inference.",
    url: "https://a2z-agent.vercel.app",
    siteName: "A2Z Agentz",
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
    title: "A2Z Agentz — Autonomous DeFi Trading Agent",
    description:
      "Multi-agent AI dashboard for autonomous DeFi trading on Base Network, powered by cloud GPU inference.",
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
          {/*
            AuthProvider reads useSearchParams() (used for the post-login
            redirect target). That hook forces a CSR bailout, which fails
            static prerendering of pages that inherit this root layout --
            notably "/404" and "/_not-found". Wrapping the provider in a
            Suspense boundary satisfies the build (next build) while keeping
            the provider's context available to the tree on the client.
          */}
          <Suspense fallback={null}>
            <AuthProvider>
              <RouteProgress />
              {children}
            </AuthProvider>
          </Suspense>
        </ToastProvider>
      </body>
    </html>
  );
}
