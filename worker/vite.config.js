import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

// Script-only Worker: no static assets to build, just the GameRoom Durable Object
// and the /api/* fetch handler.
export default defineConfig({
  plugins: [cloudflare()],
});
