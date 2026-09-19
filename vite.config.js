import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8080,
    proxy: {
      // Matches server.js's default PORT (see .env). Only used if the app
      // calls a relative /api path during `vite dev`; apiClient.js talks to
      // VITE_API_BASE_URL directly otherwise.
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
