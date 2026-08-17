import { expect, test, request as apiRequest, type BrowserContext } from '@playwright/test';
import { ALICE, HOTSPOT_FILLERS, TEST_PASSWORD } from './test-accounts';

/**
 * Incoming likes must be visible on Matches without a MenRush+ PremiumGate.
 * Liker photos open profile; Match (likeUser) succeeds from profile.
 */
test.describe.configure({ mode: 'serial' });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173';
const LIKER = HOTSPOT_FILLERS[0];

type LoginResult = {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    is_verified: boolean;
    verification_status: string;
  };
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

let alice: LoginResult;
let liker: LoginResult;

test.beforeAll(async () => {
  alice = await login(ALICE.email);
  liker = await login(LIKER.email);

  const api = await apiRequest.newContext({ baseURL: BASE_URL });
  try {
    // One-way like: Hot Spot Filler → Alice (not mutual with seed Alice↔Bob).
    const likeRes = await api.post(`/api/users/like/${alice.user.id}`, {
      headers: { Authorization: `Bearer ${liker.token}` },
    });
    expect(likeRes.ok()).toBeTruthy();
    const body = await likeRes.json();
    expect(body).toHaveProperty('match');
  } finally {
    await api.dispose();
  }
});

test('incoming likers visible on Matches without PremiumGate', async ({ browser }) => {
  const ctx = await browser.newContext();
  await authenticate(ctx, alice);
  const page = await ctx.newPage();
  await page.goto('/matches');

  await expect(page.getByRole('heading', { name: 'Matches' })).toBeVisible();
  await expect(page.getByTestId('likes-you-section')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Liked you' })).toBeVisible();
  await expect(page.getByTestId(`liker-card-${liker.user.id}`)).toBeVisible();
  await expect(page.getByText(LIKER.name).first()).toBeVisible();

  // No unsolicited MenRush+ lock / PremiumGate for incoming likes.
  await expect(page.getByText('MENRUSH+')).toHaveCount(0);
  await expect(page.getByText(/See them\./i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /unlock|upgrade|subscribe/i })).toHaveCount(0);

  await ctx.close();
});

test('photo of a liker opens their profile', async ({ browser }) => {
  const ctx = await browser.newContext();
  await authenticate(ctx, alice);
  const page = await ctx.newPage();
  await page.goto('/matches');

  const card = page.getByTestId(`liker-card-${liker.user.id}`);
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();

  await expect(page).toHaveURL(new RegExp(`/profile/${liker.user.id}`));
  await expect(page.getByTestId('profile-view-match')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(LIKER.name).first()).toBeVisible();

  await ctx.close();
});

test('likeUser success path from profile Match CTA', async ({ browser }) => {
  const ctx = await browser.newContext();
  await authenticate(ctx, alice);
  const page = await ctx.newPage();
  await page.goto(`/profile/${liker.user.id}`);

  const matchBtn = page.getByTestId('profile-view-match');
  await expect(matchBtn).toBeVisible({ timeout: 15_000 });

  const label = (await matchBtn.textContent())?.trim() ?? '';
  if (label === 'Matched' || label === 'Open chat') {
    // Already liked in a prior run — still assert the control is present and not a silent no-op CTA.
    expect(['Matched', 'Open chat']).toContain(label);
  } else {
    await expect(matchBtn).toHaveText('Match');
    await matchBtn.click();
    await expect(matchBtn).toHaveText(/Matched|Open chat|Sending/i, { timeout: 10_000 });
    await expect(page.getByText(/Match sent|matched|already sent/i).first()).toBeVisible({
      timeout: 10_000,
    });
  }

  // API-level success confirmation for the likeUser path.
  const api = await apiRequest.newContext({ baseURL: BASE_URL });
  try {
    const sent = await api.get('/api/users/likes/sent', {
      headers: { Authorization: `Bearer ${alice.token}` },
    });
    expect(sent.ok()).toBeTruthy();
    const payload = await sent.json();
    expect(payload.ids).toContain(liker.user.id);
  } finally {
    await api.dispose();
  }

  await ctx.close();
});
