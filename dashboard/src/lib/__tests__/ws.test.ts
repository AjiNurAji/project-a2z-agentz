import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAgentSocket } from "../ws";

// Minimal mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static LAST() { return MockWebSocket.instances[MockWebSocket.instances.length - 1]; }
  static reset() { MockWebSocket.instances = []; }
  url: string;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  readyState = 0;
  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
  send() {}
  close() { this.onclose?.(new CloseEvent("close")); }
  // helpers to simulate server events
  fireOpen() { this.readyState = 1; this.onopen?.(new Event("open")); }
  fireMessage(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent);
  }
  fireClose(code = 1006) { this.readyState = 3; this.onclose?.(new CloseEvent("close", { code })); }
}

describe("createAgentSocket", () => {
  beforeEach(() => {
    MockWebSocket.reset();
    vi.stubGlobal("WebSocket", MockWebSocket);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("builds ws:// URL from NEXT_PUBLIC_API_URL http", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8000");
    createAgentSocket({});
    expect(MockWebSocket.LAST().url).toBe("ws://localhost:8000/ws");
  });

  it("builds wss:// URL from https", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");
    createAgentSocket({});
    expect(MockWebSocket.LAST().url).toBe("wss://api.example.com/ws");
  });

  it("emits connecting then connected on open", () => {
    const statuses: string[] = [];
    createAgentSocket({ onStatusChange: (s) => statuses.push(s) });
    expect(statuses).toContain("connecting");
    MockWebSocket.LAST().fireOpen();
    expect(statuses).toContain("connected");
  });

  it("routes LATEST_TRANSACTIONS to onTransactions", () => {
    const txs = [{ tx_hash_id: "0x1", project_target_address: "0xabc", amount_usd: 2.0, status: "SUCCESS", created_at: "2026-06-21" }];
    const received: unknown[] = [];
    createAgentSocket({ onTransactions: (t) => received.push(t) });
    MockWebSocket.LAST().fireOpen();
    MockWebSocket.LAST().fireMessage({ type: "LATEST_TRANSACTIONS", data: txs });
    expect(received[0]).toEqual(txs);
  });

  it("routes AGENT_LOG to onAgentLog", () => {
    const log = { sender: "agent_a", content: "scanning", metadata: { score: 90 } };
    const received: unknown[] = [];
    createAgentSocket({ onAgentLog: (l) => received.push(l) });
    MockWebSocket.LAST().fireOpen();
    MockWebSocket.LAST().fireMessage({ type: "AGENT_LOG", data: log });
    expect(received[0]).toEqual(log);
  });

  it("ignores unknown message type without throwing", () => {
    const handlers = { onTransactions: vi.fn(), onAgentLog: vi.fn() };
    createAgentSocket(handlers);
    MockWebSocket.LAST().fireOpen();
    expect(() => MockWebSocket.LAST().fireMessage({ type: "UNKNOWN", data: {} })).not.toThrow();
    expect(handlers.onTransactions).not.toHaveBeenCalled();
    expect(handlers.onAgentLog).not.toHaveBeenCalled();
  });

  it("ignores malformed JSON without throwing", () => {
    const handlers = { onTransactions: vi.fn(), onAgentLog: vi.fn() };
    createAgentSocket(handlers);
    MockWebSocket.LAST().fireOpen();
    expect(() => {
      MockWebSocket.LAST().onmessage?.({ data: "not-json{{" } as MessageEvent);
    }).not.toThrow();
    expect(handlers.onTransactions).not.toHaveBeenCalled();
  });

  it("emits disconnected on close", () => {
    const statuses: string[] = [];
    createAgentSocket({ onStatusChange: (s) => statuses.push(s) });
    MockWebSocket.LAST().fireOpen();
    MockWebSocket.LAST().fireClose();
    expect(statuses).toContain("disconnected");
  });

  it("reconnects with exponential backoff after close", () => {
    createAgentSocket({});
    expect(MockWebSocket.instances.length).toBe(1);
    MockWebSocket.LAST().fireOpen();
    MockWebSocket.LAST().fireClose();
    vi.advanceTimersByTime(1000); // first backoff (1s)
    expect(MockWebSocket.instances.length).toBe(2);
  });

  it("close() prevents further reconnection and is idempotent", () => {
    const ctrl = createAgentSocket({});
    MockWebSocket.LAST().fireOpen();
    ctrl.close();
    const countAfterClose = MockWebSocket.instances.length;
    vi.advanceTimersByTime(60000); // well past any backoff
    expect(MockWebSocket.instances.length).toBe(countAfterClose);
    expect(() => ctrl.close()).not.toThrow(); // idempotent
  });

  it("is a no-op when window is undefined (SSR guard)", () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error delete window
    delete globalThis.window;
    expect(() => {
      const ctrl = createAgentSocket({});
      ctrl.close();
    }).not.toThrow();
    globalThis.window = originalWindow;
  });
});
