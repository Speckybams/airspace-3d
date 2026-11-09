import path from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { sendVoluspaceFeedback } from "./functions/lib/sendVoluspaceFeedback";

function voluspaceFeedbackDev(apiKey: string | undefined): Plugin {
  return {
    name: "voluspace-feedback-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== "POST" || req.url?.split("?")[0] !== "/api/feedback") {
          next();
          return;
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        let body: { message?: unknown; replyEmail?: unknown; page?: unknown; company?: unknown } = {};
        try {
          body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        } catch {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Invalid request." }));
          return;
        }
        if (typeof body.company === "string" && body.company.trim()) {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true }));
          return;
        }
        const key = apiKey?.trim();
        if (!key) {
          res.statusCode = 503;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Feedback email is not configured." }));
          return;
        }
        const result = await sendVoluspaceFeedback(key, {
          message: typeof body.message === "string" ? body.message : "",
          replyEmail: typeof body.replyEmail === "string" ? body.replyEmail : "",
          page: typeof body.page === "string" ? body.page : "",
        });
        res.statusCode = result.ok ? 200 : result.status;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(result.ok ? { ok: true } : { error: result.error }));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
  plugins: [react(), voluspaceFeedbackDev(env.RESEND_API_KEY)],
  server: {
    // OS raster tiles block browser CORS from localhost; proxy keeps dev same-origin.
    proxy: {
      "/api/os": {
        target: "https://api.os.uk",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/os/, ""),
      },
      "/api/weather/metar": {
        target: "https://aviationweather.gov",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/weather\/metar/, "/api/data/metar"),
      },
      "/api/weather/taf": {
        target: "https://aviationweather.gov",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/weather\/taf/, "/api/data/taf"),
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  define: {
    CESIUM_BASE_URL: JSON.stringify("/cesium/"),
  },
  build: {
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        manualChunks: {
          cesium: ["cesium"],
          react: ["react", "react-dom"],
        },
      },
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  };
});
