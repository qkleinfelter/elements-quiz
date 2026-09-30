import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

// index.html is discovered automatically as the default Vite entry. host.html and
// play.html need to be declared explicitly, scoped to the "client" Vite Environment
// (the static-assets build) - declaring them at the top level instead confuses the
// separate "worker" Environment that the Cloudflare Vite plugin also builds.
export default defineConfig({
  plugins: [cloudflare()],
  environments: {
    client: {
      build: {
        rollupOptions: {
          input: {
            main: "index.html",
            host: "host.html",
            play: "play.html",
          },
        },
      },
    },
  },
});
