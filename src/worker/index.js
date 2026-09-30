import { elements } from "../shared/data/elements.js";

const PIN_LENGTH = 6;
const PIN_MAX_ATTEMPTS = 5;

function generatePin() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  // Six digits, zero-padded; occasionally starts with 0, which is fine for a PIN.
  return String(bytes[0] % 10 ** PIN_LENGTH).padStart(PIN_LENGTH, "0");
}

async function rateLimitOrReject(limiter, key) {
  if (!limiter) return true; // no binding configured (e.g. local dev without it) - allow
  const { success } = await limiter.limit({ key });
  return success;
}

function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") ?? "unknown";
}

function checkOrigin(request, allowedOrigin) {
  const origin = request.headers.get("Origin");
  return origin === allowedOrigin;
}

async function handleCreateGame(request, env) {
  const ip = clientIp(request);
  if (!(await rateLimitOrReject(env.CREATE_LIMITER, ip))) {
    return Response.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "BAD_PAYLOAD" }, { status: 400 });
  }
  const level = ["easy", "medium", "hard"].includes(body.level) ? body.level : "easy";
  const questionCount = body.questionCount === "all" ? "all" : Math.min(Math.max(Number(body.questionCount) || 10, 1), 50);
  const timerSeconds = Math.min(Math.max(Number(body.timerSeconds) || 30, 5), 120);

  for (let attempt = 0; attempt < PIN_MAX_ATTEMPTS; attempt++) {
    const pin = generatePin();
    const id = env.GAME_ROOM.idFromName(pin);
    const stub = env.GAME_ROOM.get(id);
    const hostToken = crypto.randomUUID();
    const initResponse = await stub.fetch("https://game-room.internal/init", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin, hostToken, level, questionCount, timerSeconds, elements }),
    });
    if (initResponse.status === 409) continue; // PIN already in use; try another
    return Response.json({ pin, hostToken });
  }
  return Response.json({ error: "COULD_NOT_ALLOCATE_PIN" }, { status: 503 });
}

async function handleGameWebSocket(request, env, pin) {
  if (!checkOrigin(request, env.ALLOWED_ORIGIN)) {
    return new Response("Forbidden origin", { status: 403 });
  }
  const ip = clientIp(request);
  if (!(await rateLimitOrReject(env.JOIN_LIMITER, ip))) {
    return new Response("Rate limited", { status: 429 });
  }
  if (!/^\d{6}$/.test(pin)) {
    return new Response("Bad PIN", { status: 400 });
  }
  const id = env.GAME_ROOM.idFromName(pin);
  const stub = env.GAME_ROOM.get(id);
  return stub.fetch("https://game-room.internal/ws", request);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/games" && request.method === "POST") {
      return handleCreateGame(request, env);
    }

    const wsMatch = url.pathname.match(/^\/api\/games\/(\d{6})\/ws$/);
    if (wsMatch) {
      return handleGameWebSocket(request, env, wsMatch[1]);
    }

    return env.ASSETS.fetch(request);
  },
};

export { GameRoom } from "./gameRoom.js";
