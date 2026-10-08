import { defineConfig } from "vite";
export default defineConfig({
  define: { __OFFLINE__: false },
  server: { proxy: { "/api": { target: "http://127.0.0.1:3000" }, "/ws": { target: "ws://127.0.0.1:3000", ws: true } } },
  build: { rollupOptions: { output: { manualChunks: { three: ["three"] } } } },
});
