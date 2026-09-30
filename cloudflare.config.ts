import { bindings, defineConfig, exports } from "@cloudflare/config";
import * as entrypoint from "./src/worker/index.js" with { type: "cf-worker" };

const WORKER_NAME = "elements-quiz";
const CUSTOM_DOMAIN = "quiz.qkleinfelter.com";

export default defineConfig(({ mode }) => ({
  worker: {
    name: WORKER_NAME,
    compatibilityDate: "2026-09-30",
    entrypoint,
    assets: {
      // Solo (index.html), Live host (host.html), and Live player (play.html) are all
      // static entry points; unmatched paths fall back to index.html (Solo).
      notFoundHandling: "single-page-application",
    },
    // Only attach the custom domain in production so local/preview builds don't
    // fight over DNS that is already live.
    domains: mode === "production" ? [CUSTOM_DOMAIN] : [],
    exports: {
      // One Durable Object instance per Live game room (see src/worker/gameRoom.js).
      GameRoom: exports.durableObject({ storage: "sqlite" }),
    },
    env: {
      GAME_ROOM: bindings.durableObject({ worker: WORKER_NAME, exportName: "GameRoom" }),
      ASSETS: bindings.assets(),
      // Per-IP limits on game creation and WebSocket joins; a 6-digit PIN space
      // is guessable without them. Namespace IDs are arbitrary and only need to
      // be unique within this account.
      CREATE_LIMITER: bindings.rateLimit({ namespace: "2001", simple: { limit: 20, period: 60 } }),
      JOIN_LIMITER: bindings.rateLimit({ namespace: "2002", simple: { limit: 60, period: 60 } }),
      ALLOWED_ORIGIN: bindings.text(
        mode === "production" ? `https://${CUSTOM_DOMAIN}` : "http://localhost:8787",
      ),
    },
  },
}));
