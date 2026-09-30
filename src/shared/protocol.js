// Live-mode WebSocket message protocol (PLAN.md §7). Kept dependency-free and usable
// from both the browser and the Worker. Every incoming message is size-capped and
// validated against the schemas below; unknown or invalid messages are dropped.

export const MAX_MESSAGE_BYTES = 4096;
export const NICKNAME_MIN_LENGTH = 1;
export const NICKNAME_MAX_LENGTH = 20;
// Letters (any script), digits, spaces, and a small set of basic punctuation.
export const NICKNAME_PATTERN = /^[\p{L}\p{N} _.'-]+$/u;
export const MAX_TEXT_ANSWER_LENGTH = 40;

const ERROR_CODES = Object.freeze({
  BAD_JSON: "BAD_JSON",
  TOO_LARGE: "TOO_LARGE",
  UNKNOWN_TYPE: "UNKNOWN_TYPE",
  BAD_PAYLOAD: "BAD_PAYLOAD",
});
export { ERROR_CODES };

function isNonEmptyString(value, maxLength) {
  return typeof value === "string" && value.length >= 1 && value.length <= maxLength;
}

function isValidNickname(value) {
  return (
    typeof value === "string" &&
    value.length >= NICKNAME_MIN_LENGTH &&
    value.length <= NICKNAME_MAX_LENGTH &&
    NICKNAME_PATTERN.test(value)
  );
}

function isValidChoiceIndex(value) {
  return Number.isInteger(value) && value >= 0 && value <= 3;
}

// Each validator receives the parsed payload (message minus `type`) and returns boolean.
const CLIENT_MESSAGE_VALIDATORS = Object.freeze({
  "host.hello": (payload) => isNonEmptyString(payload.hostToken, 128),
  "host.start": () => true,
  "host.next": () => true,
  "host.skip": () => true,
  "host.kick": (payload) => isNonEmptyString(payload.playerId, 128),
  "host.end": () => true,
  "player.join": (payload) => isValidNickname(payload.nickname),
  "player.resume": (payload) => isNonEmptyString(payload.playerToken, 128),
  "player.answer": (payload) => {
    if (!isNonEmptyString(payload.questionId, 128)) return false;
    const hasChoice = payload.choice !== undefined;
    const hasText = payload.text !== undefined;
    if (hasChoice === hasText) return false; // exactly one of choice/text must be present
    if (hasChoice) return isValidChoiceIndex(payload.choice);
    return typeof payload.text === "string" && payload.text.length <= MAX_TEXT_ANSWER_LENGTH;
  },
});

export const CLIENT_MESSAGE_TYPES = Object.freeze(Object.keys(CLIENT_MESSAGE_VALIDATORS));

/**
 * Parses and validates a raw WebSocket message from a host or player client.
 * Returns `{ ok: true, type, payload }` on success, or `{ ok: false, error }` on failure.
 * Never throws.
 */
export function parseClientMessage(raw) {
  if (typeof raw !== "string") {
    return { ok: false, error: ERROR_CODES.BAD_PAYLOAD };
  }
  // Byte length, not char length: multi-byte UTF-8 nicknames shouldn't dodge the cap.
  if (new TextEncoder().encode(raw).length > MAX_MESSAGE_BYTES) {
    return { ok: false, error: ERROR_CODES.TOO_LARGE };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: ERROR_CODES.BAD_JSON };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: ERROR_CODES.BAD_PAYLOAD };
  }

  const { type, ...payload } = parsed;
  const validator = CLIENT_MESSAGE_VALIDATORS[type];
  if (!validator) {
    return { ok: false, error: ERROR_CODES.UNKNOWN_TYPE };
  }
  if (!validator(payload)) {
    return { ok: false, error: ERROR_CODES.BAD_PAYLOAD };
  }
  return { ok: true, type, payload };
}

/** Serializes a server -> client message. Thin wrapper kept for symmetry/testability. */
export function encodeServerMessage(type, payload = {}) {
  return JSON.stringify({ type, ...payload });
}
