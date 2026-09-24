import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';

const BUILD_ID = Date.now().toString(36);

export default defineConfig({
  root: '.',
  publicDir: 'public',
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID)
  },
  plugins: [{
    name: 'sw-build-id',
    closeBundle() {
      const sw = resolve(__dirname, 'dist/sw.js');
      const content = readFileSync(sw, 'utf-8').replace('__BUILD_ID__', BUILD_ID);
      writeFileSync(sw, content);
    }
  }],
  server: {
    host: true,
    port: 5500,
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
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    },
    chunkSizeWarningLimit: 600
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'js')
    }
  }
});
