import { describe, expect, it } from "vitest";
import { encodeServerMessage, MAX_MESSAGE_BYTES, parseClientMessage } from "../../shared/protocol.js";

describe("parseClientMessage", () => {
  it("accepts a well-formed host.hello message", () => {
    const result = parseClientMessage(JSON.stringify({ type: "host.hello", hostToken: "abc123" }));
    expect(result).toEqual({ ok: true, type: "host.hello", payload: { hostToken: "abc123" } });
  });

  it("accepts a well-formed player.join message", () => {
    const result = parseClientMessage(JSON.stringify({ type: "player.join", nickname: "Ada" }));
    expect(result.ok).toBe(true);
  });

  it("rejects a player.join with an invalid nickname", () => {
    expect(parseClientMessage(JSON.stringify({ type: "player.join", nickname: "" })).ok).toBe(false);
    expect(parseClientMessage(JSON.stringify({ type: "player.join", nickname: "a".repeat(21) })).ok).toBe(false);
    expect(parseClientMessage(JSON.stringify({ type: "player.join", nickname: "<script>" })).ok).toBe(false);
  });

  it("accepts a player.answer with a choice index", () => {
    const result = parseClientMessage(JSON.stringify({ type: "player.answer", questionId: "q1", choice: 2 }));
    expect(result.ok).toBe(true);
  });

  it("accepts a player.answer with typed text", () => {
    const result = parseClientMessage(JSON.stringify({ type: "player.answer", questionId: "q1", text: "marquee" }));
    expect(result.ok).toBe(true);
  });

  it("rejects a player.answer with both choice and text", () => {
    const result = parseClientMessage(JSON.stringify({ type: "player.answer", questionId: "q1", choice: 1, text: "marquee" }));
    expect(result.ok).toBe(false);
  });

  it("rejects a player.answer with neither choice nor text", () => {
    const result = parseClientMessage(JSON.stringify({ type: "player.answer", questionId: "q1" }));
    expect(result.ok).toBe(false);
  });

  it("rejects a player.answer with an out-of-range choice", () => {
    const result = parseClientMessage(JSON.stringify({ type: "player.answer", questionId: "q1", choice: 7 }));
    expect(result.ok).toBe(false);
  });

  it("rejects a player.answer with an overly long typed answer", () => {
    const result = parseClientMessage(JSON.stringify({ type: "player.answer", questionId: "q1", text: "a".repeat(41) }));
    expect(result.ok).toBe(false);
  });

  it("rejects malformed JSON", () => {
    const result = parseClientMessage("{not json");
    expect(result).toEqual({ ok: false, error: "BAD_JSON" });
  });

  it("rejects a non-string payload", () => {
    expect(parseClientMessage(undefined).ok).toBe(false);
    expect(parseClientMessage(42).ok).toBe(false);
  });

  it("rejects a JSON array or primitive at the top level", () => {
    expect(parseClientMessage("[]").ok).toBe(false);
    expect(parseClientMessage("42").ok).toBe(false);
    expect(parseClientMessage('"hello"').ok).toBe(false);
  });

  it("rejects an unknown message type", () => {
    const result = parseClientMessage(JSON.stringify({ type: "host.launch-nukes" }));
    expect(result).toEqual({ ok: false, error: "UNKNOWN_TYPE" });
  });

  it("rejects a message exceeding the byte size cap", () => {
    const huge = JSON.stringify({ type: "player.join", nickname: "Ada", padding: "x".repeat(MAX_MESSAGE_BYTES) });
    expect(parseClientMessage(huge)).toEqual({ ok: false, error: "TOO_LARGE" });
  });

  it("accepts nicknames with unicode letters", () => {
    const result = parseClientMessage(JSON.stringify({ type: "player.join", nickname: "日本語" }));
    expect(result.ok).toBe(true);
  });
});

describe("encodeServerMessage", () => {
  it("serializes a type and payload together", () => {
    const encoded = encodeServerMessage("lobby", { players: ["Ada", "Grace"] });
    expect(JSON.parse(encoded)).toEqual({ type: "lobby", players: ["Ada", "Grace"] });
  });

  it("works with no payload", () => {
    const encoded = encodeServerMessage("host.start");
    expect(JSON.parse(encoded)).toEqual({ type: "host.start" });
  });
});
