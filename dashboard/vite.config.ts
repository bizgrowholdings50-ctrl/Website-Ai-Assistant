import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/dashboard/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8081',
      '/static': 'http://localhost:8081',
    },
  },
});
