import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait()
  ],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      'assert': 'assert',
      'stream': 'stream-browserify',
      'util': 'util',
    },
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    exclude: ['monero-ts'], // Exclude monero-ts from optimization to prevent issues
    esbuildOptions: {
      target: 'esnext', // Support top-level await and WASM
    },
  },
  worker: {
    format: 'es', // Use ES modules for workers (needed for WASM)
  },
})
