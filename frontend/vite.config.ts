import { defineConfig, loadEnv, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import type { IncomingMessage } from 'http';

// HTTPS for camera/mic/calls on iPhone LAN. Set VITE_DEV_HTTPS=0 for plain HTTP only.
const useHttps = process.env.VITE_DEV_HTTPS !== '0' && process.env.VITE_DEV_HTTPS !== 'false';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendTarget =
    process.env.VITE_BACKEND_URL ||
    env.VITE_BACKEND_URL ||
    'https://backend-staging-f3aa.up.railway.app';

  function devProxy(options: ProxyOptions = {}): ProxyOptions {
    return {
      target: backendTarget,
      changeOrigin: true,
      secure: true,
      ...options,
      configure: (proxy, configureOptions) => {
        options.configure?.(proxy, configureOptions);
        proxy.on('proxyReq', (proxyReq, req: IncomingMessage) => {
          const host = req.headers.host;
          if (host) {
            const proto = useHttps ? 'https' : 'http';
            proxyReq.setHeader('Origin', `${proto}://${host}`);
          }
        });
      },
    };
  }

  return {
    plugins: [react(), ...(useHttps ? [basicSsl()] : [])],
    server: {
      host: true,
      port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
      allowedHosts: true,
      proxy: {
        '/api': devProxy(),
        '/uploads': devProxy(),
        '/socket.io': devProxy({ ws: true }),
      },
    },
  };
});
