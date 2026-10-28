import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Forward /api/* calls to the backend so the browser never hits CORS
      '/api': 'http://localhost:3001',
    },
  },
});
