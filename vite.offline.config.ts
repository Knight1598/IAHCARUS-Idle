import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
export default defineConfig({
  base: "./",
  define: { __OFFLINE__: true },
  plugins: [viteSingleFile()],
  build: { outDir: "dist-offline", rollupOptions: { input: "offline.html" } },
});
