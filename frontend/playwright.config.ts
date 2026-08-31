import { defineConfig, devices } from '@playwright/test';
import { PLAYWRIGHT_BASE_URL } from './e2e/support/base-url';

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = PLAYWRIGHT_BASE_URL;

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
    // Video-call e2e needs camera/mic; Chromium in CI otherwise blocks getUserMedia.
    ...(isCI
      ? {
          launchOptions: {
            args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
          },
          permissions: ['microphone', 'camera'],
        }
      : {}),
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 5'] },
    },
  ],
  // Playwright starts the Vite app itself — do not also `npm run dev` in CI
  // (port 4173 --strictPort would conflict).
  webServer: externalBaseUrl
    ? undefined
    : {
        command:
          'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
        url: baseURL,
        reuseExistingServer: !isCI,
        timeout: 120_000,
      },
});
