import { bindings, defineConfig, exports, triggers } from "@cloudflare/config";
import * as entrypoint from "./src/index.js" with { type: "cf-worker" };

const WORKER_NAME = "elements-quiz-api";
const SITE_HOSTNAME = "quiz.qkleinfelter.com";
const ZONE = "qkleinfelter.com";

export default defineConfig(({ mode }) => ({
  worker: {
    name: WORKER_NAME,
    compatibilityDate: "2026-09-30",
    entrypoint,
    // Only intercepts /api/* on the site's hostname (more specific than the site
    // Worker's domain-wide route, so it takes precedence); everything else falls
    // through to elements-quiz-site's static assets with no Worker invocation at all.
    triggers: mode === "production" ? [triggers.fetch({ pattern: `${SITE_HOSTNAME}/api/*`, zone: ZONE })] : [],
    exports: {
      // One Durable Object instance per Live game room (see src/gameRoom.js).
      GameRoom: exports.durableObject({ storage: "sqlite" }),
    },
    env: {
      GAME_ROOM: bindings.durableObject({ worker: WORKER_NAME, exportName: "GameRoom" }),
      // Per-IP limits on game creation and WebSocket joins; a 6-digit PIN space is
      // guessable without them. Namespace IDs are arbitrary and only need to be
      // unique within this account.
      CREATE_LIMITER: bindings.rateLimit({ namespace: "2001", simple: { limit: 20, period: 60 } }),
      JOIN_LIMITER: bindings.rateLimit({ namespace: "2002", simple: { limit: 60, period: 60 } }),
      ALLOWED_ORIGIN: bindings.text(mode === "production" ? `https://${SITE_HOSTNAME}` : "http://localhost:8787"),
    },
  },
}));
