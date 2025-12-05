import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait()],
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    minify: "esbuild",
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      net: path.resolve(__dirname, "src/polyfills/empty.ts"),
      tls: path.resolve(__dirname, "src/polyfills/empty.ts"),
      child_process: path.resolve(__dirname, "src/polyfills/child_process.ts"),
      assert: "assert",
      stream: "stream-browserify",
      util: "util",
      buffer: "buffer",
      crypto: "crypto-browserify",
      http: "stream-http",
      https: "https-browserify",
      zlib: "browserify-zlib",
      url: "url",
      querystring: "querystring-es3",
      path: "path-browserify",
      fs: "memfs",
      "#monero-ts/monero.js": path.resolve(
        __dirname,
        "node_modules/monero-ts/dist/monero.js"
      ),
    },
  },
  define: {
    global: "globalThis",
  },
  optimizeDeps: {
    exclude: [
      "monero-ts",
      "#monero-ts/monero.js",
      "request",
      "request-promise",
      "tough-cookie",
      "forever-agent",
    ], // Avoid prebundling Node-heavy deps; let rollup handle aliases
    esbuildOptions: {
      target: "esnext", // Support top-level await and WASM
    },
  },
  worker: {
    format: "es", // Use ES modules for workers (needed for WASM)
  },
});
