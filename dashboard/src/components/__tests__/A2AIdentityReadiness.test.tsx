import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import A2AIdentityReadiness from "../A2AIdentityReadiness";
import { WALLET_SESSION_KEY, type WalletSession } from "@/lib/wallet";

function saveSession(session: WalletSession) {
  localStorage.setItem(WALLET_SESSION_KEY, JSON.stringify(session));
}

describe("A2AIdentityReadiness", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows not connected when no wallet session exists", () => {
    render(<A2AIdentityReadiness wsStatus="disconnected" user={null} />);
    expect(screen.getByText("Identity Handshake Status")).toBeTruthy();
    expect(screen.getByText("Not connected")).toBeTruthy();
    expect(screen.getByText("Fallback / Demo Mode")).toBeTruthy();
  });

  it("shows connected wallet and frontend auth state", () => {
    saveSession({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      walletName: "MetaMask",
      chainId: "0x2105",
      connectedAt: "2026-06-21T00:00:00.000Z",
      connected: true, // matching EIP-1193 session indicator structure if any
      frontendOnly: true,
    } as any);

    render(<A2AIdentityReadiness wsStatus="connected" user={null} />);
    // Check elements
    const connectedHeaders = screen.getAllByRole("heading", { name: "Connected" });
    expect(connectedHeaders.length).toBeGreaterThan(0);
    expect(screen.getByText("MetaMask · 0x1234...5678")).toBeTruthy();
    expect(screen.getByText("Frontend wallet session")).toBeTruthy();
  });

  it("shows JWT authenticated when user exists", () => {
    render(<A2AIdentityReadiness wsStatus="connecting" user={{ id: 1, email: "u@b.io" }} />);
    expect(screen.getByText("JWT Authenticated")).toBeTruthy();
    expect(screen.getByText("Connecting")).toBeTruthy();
  });
});
