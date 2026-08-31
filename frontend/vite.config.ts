/// <reference types="vitest/config" />
import { defineConfig, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage } from 'http';

const backendTarget = process.env.VITE_BACKEND_URL || 'http://localhost:3000';

function devProxy(pathPrefix: string, options: ProxyOptions = {}): ProxyOptions {
  return {
    target: backendTarget,
    changeOrigin: true,
    ...options,
    configure: (proxy, configureOptions) => {
      options.configure?.(proxy, configureOptions);
      proxy.on('proxyReq', (proxyReq, req: IncomingMessage) => {
        const host = req.headers.host;
        if (host) {
          proxyReq.setHeader('Origin', `http://${host}`);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react()],
  build: {
    // Mobile phones were parsing a ~2.8MB monolith (Mapbox + every route).
    // Split vendors so chat/profile/matches do not download mapbox-gl.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('mapbox-gl')) return 'mapbox';
          if (id.includes('@sentry')) return 'sentry';
          if (id.includes('@statsig')) return 'statsig';
          if (id.includes('socket.io')) return 'socket';
          if (id.includes('heic2any')) return 'heic2any';
          return 'vendor';
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
  server: {
    host: true,
    port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
    allowedHosts: true,
    proxy: {
      '/api': devProxy('/api'),
      '/uploads': devProxy('/uploads'),
      '/socket.io': devProxy('/socket.io', { ws: true }),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: [
      'node_modules',
      'e2e',
      'dist',
      // Node built-in test runner files (npm run test:unit)
      'src/lib/notificationToasts.test.ts',
      'src/lib/profileLinks.test.ts',
    ],
  },
});
