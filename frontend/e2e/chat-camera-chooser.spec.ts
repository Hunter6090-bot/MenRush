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

/**
 * Regression: MediaRecorder historically produced
 * `video/webm;codecs=vp8,opus`. FormData serialises that with an unquoted
 * comma → busboy reports text/plain → API "Unsupported upload type".
 * The client must strip to base MIME before upload.
 */
test('video note send strips codec MIME so upload is accepted', async ({ browser }) => {
  const ctx = await browser.newContext();
  await authenticate(ctx, alice);
  await installFakeMedia(ctx);
  await ctx.addInitScript(() => {
    class FakeRecorder {
      state = 'inactive';
      mimeType = 'video/webm;codecs=vp8,opus';
      ondataavailable: ((ev: any) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {
        this.state = 'recording';
        // ≥2KB so the modal does not reject as "too short".
        const bytes = new Uint8Array(2500);
        bytes[0] = 0x1a;
        bytes[1] = 0x45;
        bytes[2] = 0xdf;
        bytes[3] = 0xa3;
        const data = new Blob([bytes], { type: this.mimeType });
        queueMicrotask(() => this.ondataavailable?.({ data }));
      }
      stop() {
        this.state = 'inactive';
        queueMicrotask(() => this.onstop?.());
      }
    }
    (FakeRecorder as any).isTypeSupported = (t: string) =>
      t === 'video/webm' || t.startsWith('video/webm;') || t === 'video/mp4';
    Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: FakeRecorder });
  });

  const page = await ctx.newPage();
  let uploadedMime: string | null = null;
  let uploadStatus: number | null = null;

  await page.route('**/api/messages/media', async (route) => {
    const req = route.request();
    const buffer = req.postDataBuffer();
    const contentType = req.headers()['content-type'] || '';
    // Multipart body embeds each part's Content-Type — assert base MIME only.
    const bodyText = buffer ? buffer.toString('latin1') : '';
    const partMime = bodyText.match(/Content-Type:\s*([^\r\n]+)/i)?.[1]?.trim() || null;
    uploadedMime = partMime;

    // If the API is up, forward; otherwise stub success so the UI path still completes.
    try {
      const response = await route.fetch();
      uploadStatus = response.status();
      await route.fulfill({ response });
    } catch {
      uploadStatus = 201;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'msg-video-note-1',
          sender_id: alice.user.id,
          receiver_id: bob.user.id,
          message: '',
          media_type: 'video',
          media_url: '/api/messages/msg-video-note-1/media',
          created_at: new Date().toISOString(),
        }),
      });
    }
  });

  await openThread(page);
  await page.getByTestId('chat-camera-button').click();
  await page.getByTestId('camera-choose-video').click();
  await expect(page.getByTestId('video-note-capture')).toBeVisible();

  // Advance fake timers enough for the 600ms minimum duration.
  await page.getByTestId('video-note-record').click();
  await page.waitForTimeout(700);
  await page.getByTestId('video-note-stop').click();
  await expect(page.getByTestId('video-note-send')).toBeVisible();
  await page.getByTestId('video-note-send').click();

  await expect.poll(() => uploadedMime).not.toBeNull();
  // Must NOT be text/plain or include codecs=
  expect(uploadedMime).toBe('video/webm');
  expect(uploadedMime).not.toMatch(/codecs/i);
  expect(uploadedMime).not.toBe('text/plain');
  // Upload accepted (real API or stub).
  await expect.poll(() => uploadStatus).toBeTruthy();
  expect(uploadStatus).toBeLessThan(400);

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
