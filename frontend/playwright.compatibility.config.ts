import { defineConfig } from '@playwright/test';

// Isolated UI contract checks: no live users, billing, maps, or production API calls.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'device-parity.spec.ts',
  fullyParallel: true,
  workers: 3,
  timeout: 30_000,
  reporter: [['list'], ['json', { outputFile: 'test-results/compatibility.json' }]],
  use: { serviceWorkers: 'block', baseURL: 'http://127.0.0.1:4175', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: ['chromium', 'webkit', 'firefox'].map(browserName => ({
    name: browserName,
    use: { browserName: browserName as 'chromium' | 'webkit' | 'firefox' },
  })),
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175', reuseExistingServer: false,
  },
});
