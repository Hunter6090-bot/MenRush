import { expect, test, request as apiRequest, type BrowserContext } from '@playwright/test';
import { ALICE, BOB, TEST_PASSWORD } from './test-accounts';
import { PLAYWRIGHT_BASE_URL as BASE_URL } from './support/base-url';

/**
 * Mutual-match full profile must show Pass · Open chat · Unmatch
 * (not two chat buttons). Unmatch must DELETE /users/like/:id.
 *
 * Investigation: ProfileView previously rendered Open chat (match CTA when
 * mutual) and Message — both navigated to /messages/:id. Unmatch was missing.
 */
test.describe.configure({ mode: 'serial' });

type LoginResult = {
  token: string;
  user: { id: string; email: string; name: string };
};

async function login(email: string): Promise<LoginResult> {
  const api = await apiRequest.newContext({ baseURL: BASE_URL });
  try {
    const response = await api.post('/api/auth/login', {
      data: { email, password: TEST_PASSWORD },
    });
    expect(response.ok()).toBeTruthy();
    return response.json();
  } finally {
    await api.dispose();
  }
}

async function authenticate(context: BrowserContext, result: LoginResult) {
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, result);
}

test('mutual profile shows Pass, Open chat, Unmatch — not two chat buttons', async ({
  browser,
}) => {
  const alice = await login(ALICE.email);
  const bob = await login(BOB.email);
  const bobId = bob.user.id;

  const api = await apiRequest.newContext({ baseURL: BASE_URL });
  try {
    await api.post('/api/users/location', {
      headers: { Authorization: `Bearer ${alice.token}` },
      data: { lat: 51.5074, lng: -0.1278 },
    });
    await api.post('/api/users/location', {
      headers: { Authorization: `Bearer ${bob.token}` },
      data: { lat: 51.508, lng: -0.128 },
    });
    await api.post(`/api/users/like/${bobId}`, {
      headers: { Authorization: `Bearer ${alice.token}` },
    });
    await api.post(`/api/users/like/${alice.user.id}`, {
      headers: { Authorization: `Bearer ${bob.token}` },
    });
  } finally {
    await api.dispose();
  }

  const context = await browser.newContext();
  await authenticate(context, alice);
  const page = await context.newPage();

  await page.goto(`/profile/${bobId}`);
  await expect(page.getByTestId('profile-view-message')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('profile-view-message')).toHaveText('Open chat');
  await expect(page.getByTestId('profile-view-unmatch')).toBeVisible();
  await expect(page.getByTestId('profile-view-unmatch')).toHaveText('Unmatch');
  await expect(page.getByRole('button', { name: 'Pass' })).toBeVisible();

  // Exactly one chat action — no duplicate Message button.
  await expect(page.getByRole('button', { name: 'Message' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open chat' })).toHaveCount(1);

  // Dismiss Home Screen install banner if it covers the action row.
  const dismissInstall = page.getByRole('button', { name: /Not now/i });
  if (await dismissInstall.isVisible().catch(() => false)) {
    await dismissInstall.click();
  }

  const unmatchReq = page.waitForRequest(
    (req) =>
      req.method() === 'DELETE' &&
      req.url().includes(`/api/users/like/${bobId}`),
  );
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByTestId('profile-view-unmatch').click();
  await unmatchReq;

  // After unmatch, Match + Message return (no longer mutual).
  await expect(page.getByTestId('profile-view-match')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('profile-view-message')).toHaveText('Message');
  await expect(page.getByTestId('profile-view-unmatch')).toHaveCount(0);

  await context.close();
});
