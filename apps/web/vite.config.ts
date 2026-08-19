import { defineConfig } from 'vite';

export default defineConfig({
  // The workspace packages export raw .ts; Vite/esbuild transpiles them fine.
  server: { port: 5173 },
  build: { target: 'es2022', outDir: 'dist' },
});
