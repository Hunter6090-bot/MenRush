import { expect, test, request as apiRequest, type BrowserContext } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173';

type LoginResult = {
  token: string;
  user: { id: string; email: string; name: string; is_verified: boolean; verification_status: string };
};

async function login(request: any, email: string): Promise<LoginResult> {
  const response = await request.post('/api/auth/login', { data: { email, password: 'password123' } });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

let alice: LoginResult;

test.beforeAll(async () => {
  const api = await apiRequest.newContext({ baseURL: BASE_URL });
  try {
    alice = await login(api, 'alice@example.com');
  } finally {
    await api.dispose();
  }
});

async function authenticate(context: BrowserContext, result: LoginResult) {
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, result);
}

// Runs under both the desktop-chromium and mobile-chromium projects, so this
// asserts the layout on a small phone and a desktop viewport (P4.2, P4.9).
test('nearby counts never cover the top category controls and controls stay clickable', async ({
  browser,
}) => {
  const ctx = await browser.newContext();
  await authenticate(ctx, alice);
  const page = await ctx.newPage();
  await page.goto('/discover');

  // The "Nearby / Online now" counts overlay renders…
  const counts = page.getByTestId('nearby-counts');
  await expect(counts).toBeVisible();

  // …and sits clearly BELOW the radius / Map-Stream control band, so it can't
  // cover the category controls.
  const radius = page.getByRole('button', { name: /km/ });
  await expect(radius).toBeVisible();
  const countsBox = await counts.boundingBox();
  const radiusBox = await radius.boundingBox();
  expect(countsBox).not.toBeNull();
  expect(radiusBox).not.toBeNull();
  expect(countsBox!.y).toBeGreaterThan(radiusBox!.y + radiusBox!.height);

  // Category controls remain clickable (Playwright throws if an overlay
  // intercepts the click). Cycling the radius is a no-op-safe interaction.
  await radius.click();

  await ctx.close();
});

test('location-blocked state is customer-facing with an enable action', async ({ browser }) => {
  const ctx = await browser.newContext();
  await authenticate(ctx, alice);
  // No geolocation permission granted → app falls back to central London.
  const page = await ctx.newPage();
  await page.goto('/discover');

  const notice = page.getByTestId('location-notice');
  await expect(notice).toBeVisible({ timeout: 15_000 });
  await expect(notice).toContainText('Showing people near central London for now');
  // No internal/developer wording leaks to the customer.
  await expect(notice).not.toContainText(/VITE_|env|dev server|undefined|null/i);
  // An obvious action to enable location is offered.
  await expect(page.getByTestId('enable-location')).toBeVisible();

  await ctx.close();
});
