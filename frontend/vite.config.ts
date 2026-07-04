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
});
