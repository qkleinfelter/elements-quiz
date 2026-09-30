import { encodeServerMessage } from "../shared/protocol.js";

const INITIAL_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 8000;

/**
 * A reconnecting WebSocket wrapper for Live mode (PLAN.md §7). Handles JSON framing,
 * exponential-backoff reconnection, and estimating the client/server clock offset from
 * the `serverNow` field carried on "question" messages, so countdowns stay accurate
 * even if the local clock is off.
 */
export class LiveSocket {
  #url;
  #ws = null;
  #backoffMs = INITIAL_BACKOFF_MS;
  #reconnectTimer = null;
  #closedByUser = false;
  #listeners = new Map(); // type -> Set<handler>
  #statusListeners = new Set();
  #clockOffsetMs = 0;
  #onOpen = null;

  constructor(url) {
    this.#url = url;
  }

  /**
   * Opens the connection. `onOpen`, if given, runs every time the socket finishes
   * opening - both the initial connect AND every automatic reconnect - since the
   * Durable Object treats each new WebSocket as unidentified until it sends
   * host.hello/player.join/player.resume as its first message. Sending that message
   * synchronously right after calling `connect()` (rather than from here) would
   * silently drop it, because the socket is still in the CONNECTING state.
   */
  connect(onOpen) {
    this.#closedByUser = false;
    this.#onOpen = onOpen;
    this.#openSocket();
  }

  close() {
    this.#closedByUser = true;
    clearTimeout(this.#reconnectTimer);
    this.#ws?.close();
  }

  on(type, handler) {
    if (!this.#listeners.has(type)) this.#listeners.set(type, new Set());
    this.#listeners.get(type).add(handler);
    return () => this.#listeners.get(type)?.delete(handler);
  }

  onStatusChange(handler) {
    this.#statusListeners.add(handler);
    return () => this.#statusListeners.delete(handler);
  }

  send(type, payload) {
    if (this.#ws?.readyState === WebSocket.OPEN) {
      this.#ws.send(encodeServerMessage(type, payload));
    }
  }

  /** Estimated current server time, for rendering an accurate countdown against `endsAt`. */
  serverNow() {
    return Date.now() + this.#clockOffsetMs;
  }

  #openSocket() {
    this.#setStatus("connecting");
    const ws = new WebSocket(this.#url);
    this.#ws = ws;

    ws.addEventListener("open", () => {
      this.#backoffMs = INITIAL_BACKOFF_MS;
      this.#setStatus("connected");
      this.#onOpen?.();
    });

    ws.addEventListener("message", (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.type === "question" && typeof message.serverNow === "number") {
        this.#clockOffsetMs = message.serverNow - Date.now();
      }
      for (const handler of this.#listeners.get(message.type) ?? []) handler(message);
    });

    ws.addEventListener("close", () => {
      this.#setStatus("disconnected");
      if (this.#closedByUser) return;
      this.#reconnectTimer = setTimeout(() => this.#openSocket(), this.#backoffMs);
      this.#backoffMs = Math.min(this.#backoffMs * 2, MAX_BACKOFF_MS);
    });

    ws.addEventListener("error", () => ws.close());
  }

  #setStatus(status) {
    for (const handler of this.#statusListeners) handler(status);
  }
}

/** Builds the wss(s)://.../api/games/:pin/ws URL for the current origin. */
export function gameSocketUrl(pin) {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/api/games/${pin}/ws`;
}
