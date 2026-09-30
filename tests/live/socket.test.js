import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveSocket } from "../../site/src/live/socket.js";

// A minimal fake WebSocket: supports addEventListener/removeEventListener, readyState,
// send, and close, plus test-only hooks to simulate the connection actually opening.
class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static instances = [];

  readyState = FakeWebSocket.CONNECTING;
  #listeners = new Map();
  sentMessages = [];

  constructor(url) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type, handler) {
    if (!this.#listeners.has(type)) this.#listeners.set(type, new Set());
    this.#listeners.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    this.#listeners.get(type)?.delete(handler);
  }

  send(data) {
    // Real WebSockets silently drop sends unless the connection is OPEN; mirror that
    // here so the test can catch the exact bug this was written to prevent.
    if (this.readyState !== FakeWebSocket.OPEN) return;
    this.sentMessages.push(data);
  }

  close() {}

  // Test-only helpers: simulate the underlying transport finishing its handshake, or
  // dropping the connection (triggering LiveSocket's reconnect logic).
  simulateOpen() {
    this.readyState = FakeWebSocket.OPEN;
    for (const handler of this.#listeners.get("open") ?? []) handler();
  }

  simulateClose() {
    for (const handler of this.#listeners.get("close") ?? []) handler();
  }
}

describe("LiveSocket", () => {
  let originalWebSocket;

  beforeEach(() => {
    originalWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = FakeWebSocket;
    FakeWebSocket.instances = [];
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
  });

  it("does not attempt to send the identify message before the socket opens", () => {
    const socket = new LiveSocket("wss://example.test/ws");
    const onOpen = vi.fn(() => socket.send("host.hello", { hostToken: "abc" }));
    socket.connect(onOpen);

    const ws = FakeWebSocket.instances[0];
    expect(onOpen).not.toHaveBeenCalled();
    expect(ws.sentMessages).toHaveLength(0);
  });

  it("sends the identify message once the socket actually opens", () => {
    const socket = new LiveSocket("wss://example.test/ws");
    socket.connect(() => socket.send("host.hello", { hostToken: "abc" }));

    const ws = FakeWebSocket.instances[0];
    ws.simulateOpen();

    expect(ws.sentMessages).toHaveLength(1);
    expect(JSON.parse(ws.sentMessages[0])).toEqual({ type: "host.hello", hostToken: "abc" });
  });

  it("re-runs the identify callback on every reconnect, not just the first connect", () => {
    vi.useFakeTimers();
    const socket = new LiveSocket("wss://example.test/ws");
    const onOpen = vi.fn(() => socket.send("player.join", { nickname: "Ada" }));
    socket.connect(onOpen);

    FakeWebSocket.instances[0].simulateOpen();
    expect(onOpen).toHaveBeenCalledTimes(1);

    // Simulate a dropped connection: LiveSocket schedules a reconnect on close.
    FakeWebSocket.instances[0].simulateClose();
    vi.runAllTimers();

    expect(FakeWebSocket.instances).toHaveLength(2);
    FakeWebSocket.instances[1].simulateOpen();
    expect(onOpen).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
