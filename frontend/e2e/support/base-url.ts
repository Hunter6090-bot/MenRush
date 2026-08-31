/**
 * Single source of truth for Playwright base URL.
 * Must match playwright.config.ts webServer (4173) and CI FRONTEND_URL —
 * never hardcode the Vite default dev port 5173.
 */
export const PLAYWRIGHT_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173';
