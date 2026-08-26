import { expect, test, request as apiRequest, type BrowserContext, type Page } from '@playwright/test';
import { TEST_PASSWORD, ALICE, BOB } from './test-accounts';
import { PLAYWRIGHT_BASE_URL as BASE_URL } from './support/base-url';


type LoginResult = {
  token: string;
  user: { id: string; email: string; name: string; is_verified: boolean; verification_status: string };
};

test.describe.configure({ mode: 'serial' });

async function login(request: any, email: string): Promise<LoginResult> {
  const response = await request.post('/api/auth/login', {
    data: { email, password: TEST_PASSWORD },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

let alice: LoginResult;
let bob: LoginResult;

test.beforeAll(async () => {
  const api = await apiRequest.newContext({ baseURL: BASE_URL });
  try {
    alice = await login(api, ALICE.email);
    bob = await login(api, BOB.email);
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

/** Fake camera/mic so getUserMedia succeeds without real hardware. */
async function installFakeMedia(context: BrowserContext) {
  await context.addInitScript(() => {
    class FakeMediaStream {
      private tracks: any[];
      constructor(tracks: any[] = []) {
        this.tracks = tracks;
      }
      getTracks() {
        return this.tracks;
      }
      getAudioTracks() {
        return this.tracks.filter((t) => t.kind === 'audio');
      }
      getVideoTracks() {
        return this.tracks.filter((t) => t.kind === 'video');
      }
      addTrack(track: any) {
        this.tracks.push(track);
      }
    }

    const tracks = [
      { kind: 'audio', enabled: true, stop() {} },
      { kind: 'video', enabled: true, stop() {} },
    ];

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => new FakeMediaStream(tracks.map((t) => ({ ...t }))),
      },
    });
    Object.defineProperty(window, 'MediaStream', { configurable: true, value: FakeMediaStream });
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
      configurable: true,
      set() {},
      get() {
        return null;
      },
    });

    // Compact still capture checks videoWidth — keep dimensions non-zero.
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
      configurable: true,
      get() {
        return 640;
      },
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
      configurable: true,
      get() {
        return 480;
      },
    });
  });
}

async function openThread(page: Page) {
  await page.goto(`/messages/${bob.user.id}`);
  await expect(page.getByRole('button', { name: /Open .*profile/i })).toBeVisible();
  await expect(page.getByTestId('chat-camera-button')).toBeVisible();
}

test('camera tap shows Picture | Video chooser', async ({ browser }) => {
  const ctx = await browser.newContext();
  await authenticate(ctx, alice);
  await installFakeMedia(ctx);
  const page = await ctx.newPage();

  await openThread(page);
  await page.getByTestId('chat-camera-button').click();

  await expect(page.getByTestId('camera-capture-chooser')).toBeVisible();
  await expect(page.getByTestId('camera-choose-picture')).toHaveText('Picture');
  await expect(page.getByTestId('camera-choose-video')).toHaveText('Video');
  // Gallery file input stays hidden — camera is not a file picker.
  await expect(page.locator('input[type="file"][aria-label="Choose from gallery"]')).toBeHidden();

  await ctx.close();
});

test('Picture opens live camera, not a file input', async ({ browser }) => {
  const ctx = await browser.newContext();
  await authenticate(ctx, alice);
  await installFakeMedia(ctx);
  const page = await ctx.newPage();

  await openThread(page);
  await page.getByTestId('chat-camera-button').click();
  await page.getByTestId('camera-choose-picture').click();

  await expect(page.getByTestId('picture-capture')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Take a picture' })).toBeVisible();
  await expect(page.getByTestId('picture-capture-shutter')).toBeVisible();
  // Chooser closes; gallery input is still not the capture path.
  await expect(page.getByTestId('camera-capture-chooser')).toHaveCount(0);
  await expect(page.locator('input[type="file"][aria-label="Choose from gallery"]')).toBeHidden();

  await ctx.close();
});

test('Video opens the video note recorder', async ({ browser }) => {
  const ctx = await browser.newContext();
  await authenticate(ctx, alice);
  await installFakeMedia(ctx);
  const page = await ctx.newPage();

  await openThread(page);
  await page.getByTestId('chat-camera-button').click();
  await page.getByTestId('camera-choose-video').click();

  await expect(page.getByTestId('video-note-capture')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Record a video note' })).toBeVisible();
  await expect(page.getByTestId('video-note-record')).toBeVisible();
  await expect(page.getByTestId('camera-capture-chooser')).toHaveCount(0);

  await ctx.close();
});

test('voice note control remains in the composer', async ({ browser }) => {
  const ctx = await browser.newContext();
  await authenticate(ctx, alice);
  await installFakeMedia(ctx);
  const page = await ctx.newPage();

  await openThread(page);

  await expect(page.getByTestId('chat-voice-button')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Record voice note' })).toBeVisible();
  // Camera and voice are separate controls — no hold-for-video on camera.
  await expect(page.getByTestId('chat-camera-button')).toHaveAttribute('aria-label', 'Open camera');
  await expect(page.getByTestId('chat-camera-button')).not.toHaveAttribute(
    'title',
    /hold for video/i,
  );

  await ctx.close();
});
