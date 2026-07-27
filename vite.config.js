import { defineConfig } from 'vite';

export default defineConfig({
  // Корень проекта — index.html, css/, js/
  root: '.',
  publicDir: 'public',
  server: {
    // 0.0.0.0 — доступ с телефона/планшета в той же Wi‑Fi сети
    host: true,
    port: 5173,
    strictPort: false,
    open: true
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: false
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
