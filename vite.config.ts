import vinext from "vinext";
import { defineConfig } from "vite";
import { sites } from "./build/sites-vite-plugin";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

export default defineConfig(() => {
  return {
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local", "localhost", "127.0.0.1"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    build: {
      rollupOptions: {
        external: ["cloudflare:workers"],
      },
    },
    ssr: {
      external: ["cloudflare:workers"],
    },
    plugins: [
      vinext(),
      sites(),
    ],
  };
});
