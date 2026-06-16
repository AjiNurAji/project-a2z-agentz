import type { Metadata } from "next";
import { Inter, Outfit, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DashboardProvider } from "@/components/DashboardContext";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "A2Z Agent — Autonomous Web3 Scavenger Dashboard",
  description: "Multi-agent AI dashboard for autonomous airdrop discovery and Agent-to-Agent payments on Base Network, powered by AMD MI300X & Llama 3.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex h-screen overflow-hidden bg-slate-950 text-slate-50 font-sans">
        <DashboardProvider>
          <Sidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <Navbar />
            <main className="flex-1 overflow-y-auto relative" id="main-content">
              {/* Ambient background effects */}
              <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
                <div className="absolute top-[-15%] right-[5%] w-[35%] h-[35%] bg-brand-purple/8 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[20%] w-[30%] h-[30%] bg-brand-accent/6 rounded-full blur-[100px]" />
              </div>
              <div className="relative z-10 p-6">
                {children}
              </div>
            </main>
          </div>
        </DashboardProvider>
      </body>
    </html>
  );
}
