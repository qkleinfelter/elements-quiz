import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

// index.html is the default Vite entry. host.html and play.html need to be declared
// explicitly, scoped to the "client" Vite Environment (the static-assets build) -
// declaring them at the top level instead confuses the separate "worker" Environment
// that the Cloudflare Vite plugin would otherwise also try to build (not applicable
// here since this project has no Worker script, but the scoping rule still applies).
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
