import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// When running in Docker, BACKEND_URL is set to http://backend:3000 (internal network).
// Locally it defaults to http://localhost:3000.
const backendTarget = process.env.BACKEND_URL || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,      // listen on 0.0.0.0 for Docker
    port: 5173,
    proxy: {
      // All /api/* requests are proxied to the backend.
      // This avoids CORS and self-signed SSL cert issues in the browser.
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
});
