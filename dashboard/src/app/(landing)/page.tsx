"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Bot, Shield, Cpu, Activity, ArrowRight, Zap, Sparkles } from "lucide-react";

import AgentScene from "@/components/landing/AgentScene";
import { ClientOnly } from "@/components/ClientOnly";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

function LandingContent() {
  const router = useRouter();
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Triggered when user enters dashboard (clicks login/register)
  const handleEnterDashboard = () => {
    setIsTransitioning(true);
  };

  const handleTransitionComplete = () => {
    router.push("/login");
  };

  return (
    <div className="relative min-h-screen bg-[var(--color-surface)] text-[var(--color-body)] overflow-hidden flex flex-col font-sans" suppressHydrationWarning={true}>
      {/* Dynamic 3D Scene Background */}
      <AgentScene
        isTransitioning={isTransitioning}
        onTransitionComplete={handleTransitionComplete}
      />

      {/* Screen Overlay/Vignette for atmospheric glow */}
      <div className="fixed inset-0 z-0 bg-radial-vignette pointer-events-none" suppressHydrationWarning={true} />

      {/* Header / Navbar */}
      <header className="relative z-20 w-full px-4 md:px-6 py-4 md:py-5 border-b border-[var(--color-border-default)] backdrop-blur-md flex items-center justify-between" style={{ background: "color-mix(in srgb, var(--color-surface) 30%, transparent)" }}>
        <div className="flex items-center gap-2 md:gap-3">
          <div
            className="w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center overflow-hidden shrink-0"
            style={{
              background: "var(--color-neutral-secondary-medium)",
              border: "1px solid var(--color-border-brand-subtle)",
            }}
          >
            <img src="/images/logo/logo.svg" className="w-6 h-6 md:w-8 md:h-8 object-contain" alt="A2Z Logo" />
          </div>
          <div>
            <h1 className="text-sm md:text-base font-bold text-[var(--color-heading)] leading-none" style={{ fontFamily: "var(--font-serif)" }}>
              A2Z Agentz
            </h1>
            <span className="hidden sm:inline-block text-[10px] text-[var(--color-fg-brand-subtle)] tracking-wider uppercase font-mono mt-0.5">Autonomous Scout & Vault</span>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <ThemeToggle />
          <button 
            onClick={handleEnterDashboard}
            disabled={isTransitioning}
            className="hidden sm:inline-block text-xs font-semibold px-4 py-2 rounded-xl text-[var(--color-heading)] hover:bg-black/5! dark:hover:bg-white/10 transition-colors"
          >
            Log In
          </button>
          <button
            onClick={handleEnterDashboard}
            disabled={isTransitioning}
            className="relative overflow-hidden text-[10px] md:text-xs font-bold px-4 py-2 md:px-5 md:py-2.5 rounded-lg md:rounded-xl transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 whitespace-nowrap"
            style={{
              background: "linear-gradient(135deg, var(--color-brand), var(--color-accent-purple))",
              border: "1px solid var(--color-border-brand)",
              boxShadow: "0 4px 14px rgba(110, 90, 124, 0.4)",
              color: "#ffffff",
            }}
          >
            <span className="flex items-center gap-1.5 md:gap-2">
              Launch App
              <ArrowRight className="w-3 h-3 md:w-3.5 md:h-3.5" />
            </span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex flex-col justify-center px-4 md:px-8 lg:px-12 py-6 md:py-10 lg:py-12 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left Column: Title & Cards (Glassmorphism overlays) */}
          <div className="lg:col-span-6 space-y-5 md:space-y-6 text-left">
            {/* Tagline */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] md:text-[11px] font-mono text-[var(--color-fg-cyan)] border backdrop-blur-sm" style={{ background: "color-mix(in srgb, var(--color-fg-cyan) 10%, transparent)", borderColor: "color-mix(in srgb, var(--color-fg-cyan) 20%, transparent)" }}>
              <Cpu className="w-3.5 h-3.5" />
              <span>AMD Hackathon ACT II Participant</span>
            </div>

            {/* Hero Heading */}
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-[var(--color-heading)] leading-[1.15] md:leading-[1.1]" style={{ fontFamily: "var(--font-serif)" }}>
              Autonomous <br />
              <span className="bg-gradient-to-r from-[var(--color-fg-cyan)] via-[var(--color-fg-brand)] to-[#b9a6c6] bg-clip-text text-transparent">
                Agent-to-Agent
              </span>
              <br />Web3 Airdrop Scavenger
            </h2>

            {/* Description */}
            <p className="text-sm md:text-base text-[var(--color-body-subtle)] max-w-xl leading-relaxed">
              Unlock hands-free multi-agent yields. Agent A scans Web3 airdrops on Farcaster & social networks, scoring sentiment via AMD Instinct™ MI300X. Agent B validates and triggers atomic executions securely on Base L2.
            </p>

            {/* Call to Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-2">
              <button
                onClick={handleEnterDashboard}
                disabled={isTransitioning}
                className="group relative flex items-center justify-center gap-2 font-bold px-6 py-3.5 md:px-7 md:py-4 rounded-xl md:rounded-2xl text-sm transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 w-full sm:w-auto"
                style={{
                  background: "linear-gradient(135deg, var(--color-brand), var(--color-accent-purple))",
                  border: "1px solid var(--color-border-brand)",
                  boxShadow: "0 8px 24px rgba(110, 90, 124, 0.3)",
                  color: "#ffffff",
                }}
              >
                Enter Mission Control
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <div className="text-[11px] text-[var(--color-body-subtle)] font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--color-success)] animate-pulse" />
                <span>Base Sepolia mainnet-sync</span>
              </div>
            </div>

            {/* Glassmorphic Agent Specs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6">
              {/* Agent A Card */}
              <div 
                className="p-5 rounded-2xl border border-[var(--color-border-default)] backdrop-blur-md flex flex-col space-y-3 transition-all duration-300 hover:border-[var(--color-fg-cyan)]"
                style={{ background: "color-mix(in srgb, var(--color-card) 40%, transparent)" }}
              >
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#7FA8A8]/10 text-[var(--color-fg-cyan)] border border-[#7FA8A8]/20">
                    <Bot className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono text-[var(--color-fg-cyan)] uppercase">Agent A (Scout)</span>
                </div>
                <h3 className="text-sm font-semibold text-[var(--color-heading)]">OSINT Sentiment Parser</h3>
                <p className="text-[11px] text-[var(--color-body-subtle)] leading-relaxed">
                  Scrapes Neynar, Farcaster, and Base explorers. Runs AIM-tuned Llama/Llama-3.1-8B-Instruct-AWQon vLLM to analyze sentiment score. Trigger at score {'>'} 85.
                </p>
              </div>

              {/* Agent B Card */}
              <div 
                className="p-5 rounded-2xl border border-[var(--color-border-default)] backdrop-blur-md flex flex-col space-y-3 transition-all duration-300 hover:border-[var(--color-fg-purple)]"
                style={{ background: "color-mix(in srgb, var(--color-card) 40%, transparent)" }}
              >
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#A78FB5]/10 text-[var(--color-fg-purple)] border border-[#A78FB5]/20">
                    <Shield className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono text-[var(--color-fg-purple)] uppercase">Agent B (Vault)</span>
                </div>
                <h3 className="text-sm font-semibold text-[var(--color-heading)]">Transaction Vault</h3>
                <p className="text-[11px] text-[var(--color-body-subtle)] leading-relaxed">
                  Signs ECDSA payloads from Scout. Uses DeepSeek-V4-Pro via Fireworks AI as a strict guardrail before broadcasting secure transfers on Base.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Live Agent-to-Agent Execution Console (GIF Showcase) */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center relative select-none">
            {/* Ambient behind-card glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-fg-cyan)]/5 to-[var(--color-fg-purple)]/10 blur-3xl opacity-60 rounded-full" />

            {/* Futuristic Terminal Window */}
            <div 
              className="relative w-full rounded-2xl border border-[var(--color-border-default)] backdrop-blur-md overflow-hidden shadow-2xl flex flex-col group hover:border-[var(--color-fg-brand)] transition-all duration-500"
              style={{
                background: "color-mix(in srgb, var(--color-card) 40%, transparent)",
                boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)"
              }}
            >
              {/* Window Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-default)]" style={{ background: "color-mix(in srgb, var(--color-surface) 60%, transparent)" }}>
                {/* Traffic Light Dots */}
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]/70" />
                </div>
                {/* Console Tab Title */}
                <div className="text-[10px] font-mono text-[var(--color-body-subtle)] tracking-wider flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-[var(--color-fg-cyan)] animate-ping" />
                  a2z-agent-coordination-grid.sh
                </div>
                {/* Status Ticker */}
                <div className="flex items-center gap-1.5 text-[9px] font-mono text-[var(--color-success)] bg-[var(--color-success-soft)]/30 px-2 py-0.5 rounded-md border border-[var(--color-success)]/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
                  LIVE
                </div>
              </div>

              {/* Console Body containing the 16:9 GIF */}
              <div className="relative aspect-[16/9] w-full overflow-hidden flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--color-surface) 90%, transparent)" }}>
                {/* The GIF Animation */}
                <img 
                  src="/gif/A2Z-animation.gif" 
                  alt="Autonomous Agent-to-Agent Web3 Scavenger Interaction" 
                  className="w-full h-full object-cover pointer-events-none select-none opacity-90 group-hover:opacity-100 transition-opacity duration-500"
                />

                {/* Grid Scan Line Effect */}
                <div className="absolute inset-0 bg-scan-line pointer-events-none opacity-[0.03]" />

                {/* HUD Overlay Elements - Top Left */}
                <div className="absolute top-3 left-4 font-mono text-[8px] md:text-[9px] text-[var(--color-fg-cyan)]/70 tracking-wider flex flex-col gap-0.5">
                  <span>COORD_X: 47.9201</span>
                  <span>SCAN_RAD: 180m</span>
                </div>

                {/* HUD Overlay Elements - Top Right */}
                <div className="absolute top-3 right-4 font-mono text-[8px] md:text-[9px] text-[var(--color-fg-brand)]/70 tracking-wider text-right flex flex-col gap-0.5">
                  <span>NETWORK: BASE_MAINNET_SYNC</span>
                  <span>ROUTING: AMD_AIM_INSTINCT</span>
                </div>

                {/* Interactive labels matching robot position in the GIF */}
                {/* Robot A (Scout) Label - Left side of the GIF */}
                <div className="absolute top-[68%] left-[8%] animate-pulse pointer-events-auto cursor-help group/scout">
                  <div className="px-2.5 py-1 border border-[var(--color-fg-cyan)] rounded-lg text-[9px] font-mono flex items-center gap-1.5 backdrop-blur-sm shadow-lg hover:border-[var(--color-fg-cyan)] transition-colors" style={{ background: "color-mix(in srgb, var(--color-surface) 80%, transparent)" }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#7FA8A8]" />
                    <span>Agent A (Scout)</span>
                  </div>
                  {/* Tooltip detail */}
                  <div className="absolute left-0 mt-1.5 w-44 p-2 border border-[var(--color-fg-cyan)] rounded-lg text-[9px] font-mono text-[var(--color-body-subtle)] leading-normal opacity-0 group-hover/scout:opacity-100 transition-opacity duration-300 pointer-events-none shadow-2xl backdrop-blur-md z-30" style={{ background: "color-mix(in srgb, var(--color-card) 95%, transparent)" }}>
                    <span className="text-[var(--color-fg-cyan)] font-bold">OSINT Scanner:</span> Scanning social feeds, scoring alpha sentiment score in &lt;1.2s.
                  </div>
                </div>

                {/* Robot B (Vault) Label - Right side of the GIF */}
                <div className="absolute top-[68%] right-[8%] animate-pulse pointer-events-auto cursor-help group/vault" style={{ animationDelay: "0.8s" }}>
                  <div className="px-2.5 py-1 border border-[var(--color-fg-purple)] rounded-lg text-[9px] font-mono flex items-center gap-1.5 backdrop-blur-sm shadow-lg hover:border-[var(--color-fg-purple)] transition-colors" style={{ background: "color-mix(in srgb, var(--color-surface) 80%, transparent)" }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#A78FB5]" />
                    <span>Agent B (Vault)</span>
                  </div>
                  {/* Tooltip detail */}
                  <div className="absolute right-0 mt-1.5 w-44 p-2 border border-[var(--color-fg-purple)] rounded-lg text-[9px] font-mono text-[var(--color-body-subtle)] leading-normal opacity-0 group-hover/vault:opacity-100 transition-opacity duration-300 pointer-events-none shadow-2xl backdrop-blur-md z-30" style={{ background: "color-mix(in srgb, var(--color-card) 95%, transparent)" }}>
                    <span className="text-[var(--color-fg-purple)] font-bold">Secure Vault:</span> Validating transactions, resolving gas station, executing on Base L2.
                  </div>
                </div>

                {/* HUD Overlay Elements - Bottom Left */}
                <div className="absolute bottom-3 left-4 font-mono text-[8px] md:text-[9px] text-[var(--color-body-subtle)]/50 tracking-wider">
                  <span>SYSTEM_MODE: AUTO_PILOT</span>
                </div>

                {/* HUD Overlay Elements - Bottom Right */}
                <div className="absolute bottom-3 right-4 font-mono text-[8px] md:text-[9px] text-[var(--color-success)]/70 tracking-wider text-right flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
                  <span>SECURE_ORACLE_CONNECTED</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Tech Stack / Bottom Footer */}
      <footer className="relative z-20 w-full py-6 md:py-8 border-t border-[var(--color-border-default)] backdrop-blur-md px-4 md:px-6 flex flex-col lg:flex-row gap-5 lg:gap-6 items-center justify-between text-[10px] md:text-xs" style={{ background: "color-mix(in srgb, var(--color-surface) 40%, transparent)" }}>
        <div className="text-[var(--color-body-subtle)] font-mono text-center lg:text-left w-full lg:w-auto">
          Powered by <br className="md:hidden" /> <span className="text-[var(--color-heading)] font-semibold">AMD Instinct™ MI300X</span> &amp; <span className="text-[var(--color-heading)] font-semibold">Base L2</span>
        </div>

        {/* Tech StackBadges */}
        <div className="flex flex-wrap justify-center lg:justify-end items-center gap-2 md:gap-3 w-full lg:w-auto">
          <span className="px-2 md:px-2.5 py-1 rounded border border-[var(--color-border-default)] font-mono text-[9px] md:text-[10px]" style={{ background: "color-mix(in srgb, var(--color-neutral-secondary-strong) 50%, transparent)" }}>AIM (AMD Inference Microservice)</span>
          <span className="px-2 md:px-2.5 py-1 rounded border border-[var(--color-border-default)] font-mono text-[9px] md:text-[10px]" style={{ background: "color-mix(in srgb, var(--color-neutral-secondary-strong) 50%, transparent)" }}>ROCm 6.x</span>
          <span className="px-2 md:px-2.5 py-1 rounded border border-[var(--color-border-default)] font-mono text-[9px] md:text-[10px]" style={{ background: "color-mix(in srgb, var(--color-neutral-secondary-strong) 50%, transparent)" }}>vLLM on ROCm</span>
          <span className="px-2 md:px-2.5 py-1 rounded border border-[var(--color-border-default)] font-mono text-[9px] md:text-[10px]" style={{ background: "color-mix(in srgb, var(--color-neutral-secondary-strong) 50%, transparent)" }}>LangGraph Python</span>
          <span className="px-2 md:px-2.5 py-1 rounded border border-[var(--color-border-default)] font-mono text-[9px] md:text-[10px]" style={{ background: "color-mix(in srgb, var(--color-neutral-secondary-strong) 50%, transparent)" }}>ChromaDB</span>
        </div>
      </footer>

      {/* Full screen overlay transition during login */}
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 z-50 backdrop-blur-sm pointer-events-none"
            style={{ background: "color-mix(in srgb, var(--color-surface) 60%, transparent)" }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LandingPage() {
  return (
    <ClientOnly
      fallback={
        <div className="relative min-h-screen bg-[#13111C] flex items-center justify-center">
          <div className="animate-pulse text-[var(--color-body-subtle)] font-mono text-sm">
            Loading...
          </div>
        </div>
      }
    >
      <LandingContent />
    </ClientOnly>
  );
}
