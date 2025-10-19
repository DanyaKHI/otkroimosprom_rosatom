import { resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "build",
  },
  resolve: {
    alias: [
      {
        find: "@",
        replacement: resolve(__dirname, "./src"),
      },
      {
        find: "@app",
        replacement: resolve(__dirname, "./src/app"),
      },
      {
        find: "@assets",
        replacement: resolve(__dirname, "./src/assets"),
      },
      {
        find: "@entities",
        replacement: resolve(__dirname, "./src/entities"),
      },
      {
        find: "@features",
        replacement: resolve(__dirname, "./src/features"),
      },
      {
        find: "@locale",
        replacement: resolve(__dirname, "./src/locale"),
      },
      {
        find: "@pages",
        replacement: resolve(__dirname, "./src/pages"),
      },
      {
        find: "@shared",
        replacement: resolve(__dirname, "./src/shared"),
      },
      {
        find: "@styles",
        replacement: resolve(__dirname, "./src/styles"),
      },
      {
        find: "@vars",
        replacement: resolve(__dirname, "./src/app/styles/vars"),
      },
      {
        find: "@widgets",
        replacement: resolve(__dirname, "./src/widgets"),
      },
    ],
  },
  define: {
    global: 'window',
  },
});
