import net from "node:net";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const isBackendRunning = (host = "127.0.0.1", port = 5000, timeoutMs = 150) =>
  new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;

    const finish = (reachable) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(reachable);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });

const createBackendProxy = (ws = false) => ({
  target: "http://localhost:5000",
  changeOrigin: true,
  ...(ws ? { ws: true } : {}),
  async bypass(req, res) {
    const reachable = await isBackendRunning("127.0.0.1", 5000);
    if (reachable) {
      return undefined;
    }

    if (res && typeof res.setHeader === "function" && !res.writableEnded) {
      res.statusCode = 503;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          message:
            "Backend server is not running on http://localhost:5000. Start MongoDB and run: npm --prefix backend run dev",
        })
      );
      return req.url;
    }

    return false;
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
    proxy: {
      "/api": createBackendProxy(false),
      "/socket.io": createBackendProxy(true),
    },
  },
});