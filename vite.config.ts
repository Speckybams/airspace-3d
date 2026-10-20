import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
});
