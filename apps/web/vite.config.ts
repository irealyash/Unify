import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const SERVER_URL = process.env.UNIFY_SERVER_URL || "http://localhost:3001";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Load settings from the monorepo root `.env`.
  envDir: fileURLToPath(new URL("../..", import.meta.url)),
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Let teammates reach your dev server through a tunnel (see README → "Playing together").
    allowedHosts: [".trycloudflare.com", ".ngrok-free.app"],
    // Proxy the socket to the game server so the browser talks to one origin in dev.
    proxy: {
      "/socket.io": { target: SERVER_URL, ws: true },
    },
  },
});
