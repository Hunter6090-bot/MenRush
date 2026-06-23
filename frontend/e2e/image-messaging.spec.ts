import { expect, test, request as apiRequest, type BrowserContext, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173';

// A valid 1x1 PNG (correct signature, so it passes the backend's content check).
const PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

type LoginResult = {
  token: string;
  user: { id: string; email: string; name: string; is_verified: boolean; verification_status: string };
};

async function login(request: any, email: string): Promise<LoginResult> {
  const response = await request.post('/api/auth/login', {
    data: { email, password: 'password123' },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

// One login per user for the whole serial file (backend rate-limits auth).
let alice: LoginResult;
let bob: LoginResult;

test.beforeAll(async () => {
  const api = await apiRequest.newContext({ baseURL: BASE_URL });
  try {
    alice = await login(api, 'alice@example.com');
    bob = await login(api, 'bob@example.com');
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

async function attachImage(page: Page) {
  await page
    .locator('input[type="file"][aria-label="Attach photo"]')
    .setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: PNG_BUFFER });
}

/** Send with optional custom view count when rule is 'custom'. */
async function aliceSendsImage(
  page: Page,
  rule: 'permanent' | 'once' | 'twice' | 'custom',
  customCount?: number,
) {
  await page.goto(`/messages/${bob.user.id}`);
  await expect(page.getByRole('button', { name: /Open .*profile/i })).toBeVisible();
  await attachImage(page);
  await expect(page.getByTestId('image-composer')).toBeVisible();
  await page.getByTestId(`rule-${rule}`).click();
  if (rule === 'custom' && customCount != null) {
    const current = await page.getByTestId('custom-views').locator('span').textContent();
    const match = current?.match(/(\d+)/);
    const now = match ? parseInt(match[1], 10) : 3;
    const delta = customCount - now;
    const btn = delta > 0 ? 'More views' : 'Fewer views';
    for (let i = 0; i < Math.abs(delta); i++) {
      await page.getByRole('button', { name: btn }).click();
    }
  }
  await page.getByTestId('image-composer-send').click();
  // Composer closes once the upload completes.
  await expect(page.getByTestId('image-composer')).toHaveCount(0);
}

test('selecting an image shows a preview with view-rule and Send/Cancel controls', async ({
  browser,
}) => {
  const ctx = await browser.newContext();
  await authenticate(ctx, alice);
  const page = await ctx.newPage();

  await page.goto(`/messages/${bob.user.id}`);
  await expect(page.getByRole('button', { name: /Open .*profile/i })).toBeVisible();
  await attachImage(page);

  // Preview + controls are shown; nothing is sent yet.
  await expect(page.getByTestId('image-composer')).toBeVisible();
  await expect(page.getByTestId('image-composer-preview')).toBeVisible();
  await expect(page.getByTestId('image-composer-send')).toBeVisible();
  await expect(page.getByTestId('image-composer-cancel')).toBeVisible();
  // Default rule is clearly shown.
  await expect(page.getByTestId('image-composer-rule')).toHaveText('View once');

  // The sender can change the rule and the label updates.
  await page.getByTestId('rule-permanent').click();
  await expect(page.getByTestId('image-composer-rule')).toHaveText('Keep in chat');
  await page.getByTestId('rule-custom').click();
  await expect(page.getByTestId('custom-views')).toBeVisible();

  await ctx.close();
});

test('cancelling the composer discards the image without sending', async ({ browser }) => {
  const ctx = await browser.newContext();
  await authenticate(ctx, alice);
  const page = await ctx.newPage();

  await page.goto(`/messages/${bob.user.id}`);
  await expect(page.getByRole('button', { name: /Open .*profile/i })).toBeVisible();
  await attachImage(page);
  await expect(page.getByTestId('image-composer')).toBeVisible();

  await page.getByTestId('image-composer-cancel').click();
  await expect(page.getByTestId('image-composer')).toHaveCount(0);

  await ctx.close();
});

test('a permanent image stays available inline for the recipient', async ({ browser }) => {
  const aliceCtx = await browser.newContext();
  const bobCtx = await browser.newContext();
  await authenticate(aliceCtx, alice);
  await authenticate(bobCtx, bob);

  const alicePage = await aliceCtx.newPage();
  await aliceSendsImage(alicePage, 'permanent');

  const bobPage = await bobCtx.newPage();
  await bobPage.goto(`/messages/${alice.user.id}`);
  // Recipient sees the image inline — no "tap to view", no tombstone.
  await expect(bobPage.getByTestId('image-permanent').first()).toBeVisible();

  await aliceCtx.close();
  await bobCtx.close();
});

test('a view-once image is shown then becomes unavailable after one view', async ({ browser }) => {
  const aliceCtx = await browser.newContext();
  const bobCtx = await browser.newContext();
  await authenticate(aliceCtx, alice);
  await authenticate(bobCtx, bob);

  const alicePage = await aliceCtx.newPage();
  await aliceSendsImage(alicePage, 'once');

  const bobPage = await bobCtx.newPage();
  await bobPage.goto(`/messages/${alice.user.id}`);

  const locked = bobPage.getByTestId('image-locked').last();
  await expect(locked).toBeVisible();
  await expect(locked.getByTestId('image-remaining')).toHaveText('1 view left');

  // Open → the image loads and the view is consumed (meta appears once shown).
  await locked.click();
  await expect(bobPage.getByTestId('image-viewer')).toBeVisible();
  await expect(bobPage.getByTestId('image-viewer-meta')).toBeVisible({ timeout: 10_000 });
  await bobPage.getByTestId('image-viewer-close').click();

  // Exhausted → "No longer available" tombstone, and it survives a reload.
  await expect(bobPage.getByTestId('image-unavailable').last()).toBeVisible();
  await bobPage.reload();
  await expect(bobPage.getByTestId('image-unavailable').last()).toBeVisible();

  await aliceCtx.close();
  await bobCtx.close();
});

test('a two-view image allows exactly two views', async ({ browser }) => {
  const aliceCtx = await browser.newContext();
  const bobCtx = await browser.newContext();
  await authenticate(aliceCtx, alice);
  await authenticate(bobCtx, bob);

  const alicePage = await aliceCtx.newPage();
  await aliceSendsImage(alicePage, 'twice');

  const bobPage = await bobCtx.newPage();
  await bobPage.goto(`/messages/${alice.user.id}`);

  const locked = bobPage.getByTestId('image-locked').last();
  await expect(locked.getByTestId('image-remaining')).toHaveText('2 views left');

  // First view consumes one, leaving one.
  await locked.click();
  await expect(bobPage.getByTestId('image-viewer-meta')).toBeVisible({ timeout: 10_000 });
  await bobPage.getByTestId('image-viewer-close').click();
  await expect(bobPage.getByTestId('image-locked').last().getByTestId('image-remaining')).toHaveText(
    '1 view left',
  );

  // Second view exhausts it.
  await bobPage.getByTestId('image-locked').last().click();
  await expect(bobPage.getByTestId('image-viewer-meta')).toBeVisible({ timeout: 10_000 });
  await bobPage.getByTestId('image-viewer-close').click();
  await expect(bobPage.getByTestId('image-unavailable').last()).toBeVisible();

  await aliceCtx.close();
  await bobCtx.close();
});

test('a failed image load does not consume a view', async ({ browser }) => {
  const aliceCtx = await browser.newContext();
  const bobCtx = await browser.newContext();
  await authenticate(aliceCtx, alice);
  await authenticate(bobCtx, bob);

  const alicePage = await aliceCtx.newPage();
  await aliceSendsImage(alicePage, 'once');

  const bobPage = await bobCtx.newPage();
  // Force the next media fetch to fail so the image can't load.
  let failMedia = true;
  await bobPage.route('**/api/messages/**/media**', async (route) => {
    if (failMedia) return route.fulfill({ status: 500, body: 'boom' });
    return route.continue();
  });

  await bobPage.goto(`/messages/${alice.user.id}`);
  const locked = bobPage.getByTestId('image-locked').last();
  await expect(locked).toBeVisible();

  // Open → load fails → honest error, retry offered, NO view consumed.
  await locked.click();
  await expect(bobPage.getByTestId('image-viewer-retry')).toBeVisible({ timeout: 10_000 });
  await bobPage.getByText('No view was used.').waitFor();
  await bobPage.getByTestId('image-viewer-close').click();

  // Still a locked card with the view intact — not a tombstone.
  await expect(bobPage.getByTestId('image-locked').last().getByTestId('image-remaining')).toHaveText(
    '1 view left',
  );

  // Allow media through and confirm the view is still spendable.
  failMedia = false;
  await bobPage.getByTestId('image-locked').last().click();
  await expect(bobPage.getByTestId('image-viewer-meta')).toBeVisible({ timeout: 10_000 });

  await aliceCtx.close();
  await bobCtx.close();
});

test('oversized / wrong-type files are rejected before sending', async ({ browser }) => {
  const ctx = await browser.newContext();
  await authenticate(ctx, alice);
  const page = await ctx.newPage();

  await page.goto(`/messages/${bob.user.id}`);
  await expect(page.getByRole('button', { name: /Open .*profile/i })).toBeVisible();

  // A non-image file is rejected with a useful error and never staged.
  await page
    .locator('input[type="file"][aria-label="Attach photo"]')
    .setInputFiles({ name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await expect(page.getByText(/Only JPEG, PNG or WebP/i)).toBeVisible();
  await expect(page.getByTestId('image-composer')).toHaveCount(0);

  // An oversized image is rejected before the composer opens.
  const huge = Buffer.alloc(13 * 1024 * 1024, 0xff);
  await page
    .locator('input[type="file"][aria-label="Attach photo"]')
    .setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: huge });
  await expect(page.getByText(/too large/i)).toBeVisible();
  await expect(page.getByTestId('image-composer')).toHaveCount(0);

  await ctx.close();
});

test('a custom-view image allows exactly the configured number of views', async ({ browser }) => {
  const aliceCtx = await browser.newContext();
  const bobCtx = await browser.newContext();
  await authenticate(aliceCtx, alice);
  await authenticate(bobCtx, bob);

  const alicePage = await aliceCtx.newPage();
  await aliceSendsImage(alicePage, 'custom', 3);

  const bobPage = await bobCtx.newPage();
  await bobPage.goto(`/messages/${alice.user.id}`);

  const locked = bobPage.getByTestId('image-locked').last();
  await expect(locked.getByTestId('image-remaining')).toHaveText('3 views left');

  for (let i = 2; i >= 1; i--) {
    await bobPage.getByTestId('image-locked').last().click();
    await expect(bobPage.getByTestId('image-viewer-meta')).toBeVisible({ timeout: 10_000 });
    await bobPage.getByTestId('image-viewer-close').click();
    await expect(bobPage.getByTestId('image-locked').last().getByTestId('image-remaining')).toHaveText(
      `${i} view${i === 1 ? '' : 's'} left`,
    );
  }

  // Final view exhausts the image.
  await bobPage.getByTestId('image-locked').last().click();
  await expect(bobPage.getByTestId('image-viewer-meta')).toBeVisible({ timeout: 10_000 });
  await bobPage.getByTestId('image-viewer-close').click();
  await expect(bobPage.getByTestId('image-unavailable').last()).toBeVisible();

  await aliceCtx.close();
  await bobCtx.close();
});

test('rapid duplicate taps on a locked card do not over-consume views', async ({ browser }) => {
  const aliceCtx = await browser.newContext();
  const bobCtx = await browser.newContext();
  await authenticate(aliceCtx, alice);
  await authenticate(bobCtx, bob);

  const alicePage = await aliceCtx.newPage();
  await aliceSendsImage(alicePage, 'once');

  const bobPage = await bobCtx.newPage();
  await bobPage.goto(`/messages/${alice.user.id}`);

  const locked = bobPage.getByTestId('image-locked').last();
  await expect(locked.getByTestId('image-remaining')).toHaveText('1 view left');

  // Hammer the card — only one viewer, one view consumed after load.
  await locked.click({ clickCount: 3 });
  await expect(bobPage.getByTestId('image-viewer')).toBeVisible();
  await expect(bobPage.getByTestId('image-viewer-meta')).toBeVisible({ timeout: 10_000 });
  await bobPage.getByTestId('image-viewer-close').click();
  await expect(bobPage.getByTestId('image-unavailable').last()).toBeVisible();

  await aliceCtx.close();
  await bobCtx.close();
});
