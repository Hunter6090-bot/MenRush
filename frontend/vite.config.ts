import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        headers: { Origin: 'http://localhost:5173' },
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
        headers: { Origin: 'http://localhost:5173' },
      },
    },
  },
});
