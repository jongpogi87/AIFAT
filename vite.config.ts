import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "next/navigation": path.resolve(__dirname, "./lib/router.tsx"),
      "next/link": path.resolve(__dirname, "./lib/router.tsx"),
    },
  },
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      // Exclude server-only external packages from the client build
      external: [
        "cloudflare:workers",
        "firebase-admin",
        "@google-cloud/firestore",
      ],
    },
  },
  server: {
    port: 3000,
    host: "0.0.0.0",
    allowedHosts: ["terminal.local", "localhost", "127.0.0.1"],
  },
});
