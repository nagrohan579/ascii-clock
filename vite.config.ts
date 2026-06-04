import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    headers: {
      // Enable cross-origin isolation for WebGPU/WASM threading in transformers.js
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    target: 'esnext',
  },
});
