import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import WalletConnectModal from "../WalletConnectModal";

function setEthereum(provider: unknown) {
  Object.defineProperty(window, "ethereum", {
    value: provider,
    configurable: true,
    writable: true,
  });
}

describe("WalletConnectModal", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = "a2z-wallet-session=; Max-Age=0; path=/";
    setEthereum(undefined);
  });

  it("does not render when closed", () => {
    render(<WalletConnectModal open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders wallet options when open", () => {
    render(<WalletConnectModal open onClose={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("MetaMask")).toBeTruthy();
    expect(screen.getByText("Coinbase Wallet")).toBeTruthy();
    expect(screen.getByText("Rabby")).toBeTruthy();
    expect(screen.getByText("Browser Wallet")).toBeTruthy();
  });

  it("connects detected wallet and shows SIWE warning", async () => {
    const request = vi.fn(async ({ method }: { method: string }) => {
      if (method === "eth_requestAccounts") return ["0x1234567890abcdef1234567890abcdef12345678"];
      if (method === "eth_chainId") return "0x2105";
      return null;
    });
    setEthereum({ isMetaMask: true, request });
    const onConnected = vi.fn();

    render(<WalletConnectModal open onClose={vi.fn()} onConnected={onConnected} />);
    await userEvent.click(screen.getByRole("button", { name: /connect metamask/i }));

    await waitFor(() => {
      expect(screen.getByText(/Wallet login is frontend-only/i)).toBeTruthy();
    });
    expect(screen.getByText(/0x1234...5678/i)).toBeTruthy();
    expect(onConnected).toHaveBeenCalledWith(expect.objectContaining({ address: "0x1234567890abcdef1234567890abcdef12345678" }));
  });

  it("shows rejected connection error", async () => {
    const request = vi.fn(async () => {
      throw new Error("User rejected");
    });
    setEthereum({ isMetaMask: true, request });

    render(<WalletConnectModal open onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /connect metamask/i }));

    await waitFor(() => {
      expect(screen.getByText(/Connection rejected/i)).toBeTruthy();
    });
  });

  it("calls onContinue when continue button is clicked", async () => {
    const request = vi.fn(async ({ method }: { method: string }) => {
      if (method === "eth_requestAccounts") return ["0x1234567890abcdef1234567890abcdef12345678"];
      if (method === "eth_chainId") return "0x2105";
      return null;
    });
    setEthereum({ isMetaMask: true, request });
    const onContinue = vi.fn();

    render(<WalletConnectModal open onClose={vi.fn()} onContinue={onContinue} />);
    await userEvent.click(screen.getByRole("button", { name: /connect metamask/i }));
    await userEvent.click(await screen.findByRole("button", { name: /continue to dashboard/i }));

    expect(onContinue).toHaveBeenCalled();
  });

  it("allows connecting mock wallet when no provider exists (demo mode)", async () => {
    const onContinue = vi.fn();
    render(<WalletConnectModal open onClose={vi.fn()} onContinue={onContinue} />);
    
    // In demo mode, even if "install required", clicking should generate a mock connection
    await userEvent.click(screen.getByRole("button", { name: /connect metamask/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Wallet login is frontend-only/i)).toBeTruthy();
    });
    
    expect(screen.getByText(/0x[a-fA-F0-9]{4}\.\.\.[a-fA-F0-9]{4}/i)).toBeTruthy();
    
    await userEvent.click(screen.getByRole("button", { name: /continue to dashboard/i }));
    expect(onContinue).toHaveBeenCalled();
  });
});
