import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Built output goes to ../m so the existing static site can serve it at /m/ with no build step on the host.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: '../m', emptyOutDir: true },
  server: { port: 5174 }
});
