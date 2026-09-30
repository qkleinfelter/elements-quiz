import { defineConfig } from "@cloudflare/config";

// Static-assets-only Worker: no entrypoint/script, so Cloudflare serves matched files
// directly with zero script invocations. Only /api/* is excluded from this domain (see
// worker/cloudflare.config.ts's route), so page loads and asset fetches never touch a
// Worker at all, unlike the earlier single-Worker-with-assets setup.
export default defineConfig(({ mode }) => ({
  worker: {
    name: "elements-quiz-site",
    compatibilityDate: "2026-09-30",
    assets: {
      notFoundHandling: "single-page-application",
    },
    domains: mode === "production" ? ["quiz.qkleinfelter.com"] : [],
  },
}));
