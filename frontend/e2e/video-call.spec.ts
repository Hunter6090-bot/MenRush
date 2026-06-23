import { expect, test, request as apiRequest, type BrowserContext } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173';

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

// Log in once for the whole (serial) file. The backend rate-limits auth to
// ~10 attempts / 15 min per IP, so logging in per-test would trip it; sharing
// keeps the entire suite at two logins and makes runs deterministic.
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

async function installFakeMedia(context: BrowserContext) {
  await context.addInitScript(() => {
    class FakeMediaStream {
      private tracks: any[];
      constructor(tracks: any[] = []) { this.tracks = tracks; }
      getTracks() { return this.tracks; }
      getAudioTracks() { return this.tracks.filter((track) => track.kind === 'audio'); }
      getVideoTracks() { return this.tracks.filter((track) => track.kind === 'video'); }
      addTrack(track: any) { this.tracks.push(track); }
    }

    class FakePeerConnection {
      ontrack: ((event: any) => void) | null = null;
      onicecandidate: ((event: any) => void) | null = null;
      addTrack() {}
      async createOffer() { return { type: 'offer', sdp: 'test-offer' }; }
      async createAnswer() { return { type: 'answer', sdp: 'test-answer' }; }
      async setLocalDescription() {}
      async setRemoteDescription() {}
      async addIceCandidate() {}
      close() {}
    }

    const tracks = [
      { kind: 'audio', enabled: true, stop() {} },
      { kind: 'video', enabled: true, stop() {} },
    ];
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => new FakeMediaStream(tracks) },
    });
    Object.defineProperty(window, 'MediaStream', { configurable: true, value: FakeMediaStream });
    // The native HTMLMediaElement.srcObject setter type-checks against the real
    // MediaStream and would throw for our fake. Make it a permissive no-op so
    // attaching a fake preview stream doesn't crash the call surface in tests.
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
      configurable: true,
      set() {},
      get() { return null; },
    });
    Object.defineProperty(window, 'RTCPeerConnection', { configurable: true, value: FakePeerConnection });
    Object.defineProperty(window, 'RTCSessionDescription', {
      configurable: true,
      value: class { constructor(value: any) { Object.assign(this, value); } },
    });
    Object.defineProperty(window, 'RTCIceCandidate', {
      configurable: true,
      value: class { constructor(value: any) { Object.assign(this, value); } },
    });
  });
}

test('an insecure device shows a useful error instead of an endless calling state', async ({
  page,
}) => {
  await authenticate(page.context(), alice);
  // Simulate an insecure / no-media context the same way the app detects it
  // (`!navigator.mediaDevices?.getUserMedia`) — hermetically, without relying
  // on a specific LAN IP/origin that varies per machine.
  await page.context().addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
  });

  await page.goto(`/messages/${bob.user.id}`);
  await expect(page.getByRole('button', { name: /Open .*profile/i })).toBeVisible();
  await page.getByRole('button', { name: 'Start video call' }).click();

  await expect(page.getByText('Video calls need HTTPS')).toBeVisible();
  await expect(page.getByText('Calling Bob')).not.toBeVisible();
});

async function installBlockedMedia(context: BrowserContext) {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          const err = new Error('Permission denied');
          err.name = 'NotAllowedError';
          throw err;
        },
      },
    });
    class FakePeerConnection {
      ontrack: any = null; onicecandidate: any = null;
      addTrack() {}
      async createOffer() { return { type: 'offer', sdp: 'x' }; }
      async createAnswer() { return { type: 'answer', sdp: 'x' }; }
      async setLocalDescription() {}
      async setRemoteDescription() {}
      async addIceCandidate() {}
      close() {}
    }
    Object.defineProperty(window, 'RTCPeerConnection', { configurable: true, value: FakePeerConnection });
  });
}

async function setCallTimeout(context: BrowserContext, ms: number) {
  await context.addInitScript((value) => {
    (window as any).__MENRUSH_CALL_TIMEOUT_MS__ = value;
  }, ms);
}

test('the caller sees a full-screen local preview with controls while ringing', async ({
  browser,
}) => {
  const aliceContext = await browser.newContext();

  await authenticate(aliceContext, alice);
  await installFakeMedia(aliceContext);

  const alicePage = await aliceContext.newPage();
  await alicePage.goto(`/messages/${bob.user.id}`);
  // Wait for the peer profile to load so the call button has a name to use.
  await expect(alicePage.getByRole('button', { name: /Open .*profile/i })).toBeVisible();
  await alicePage.getByRole('button', { name: 'Start video call' }).click();

  // Full-screen outgoing surface (not the small "Calling Bob" card).
  const surface = alicePage.getByTestId('outgoing-call');
  await expect(surface).toBeVisible();
  await expect(surface.locator('video')).toBeAttached();
  await expect(alicePage.getByText('Calling Bob')).not.toBeVisible();

  // Ringing status + callee name overlay.
  await expect(surface.getByText(/Ringing/i)).toBeVisible();
  await expect(surface.getByText('Bob', { exact: true })).toBeVisible();

  // Controls remain available while ringing.
  await expect(alicePage.getByRole('button', { name: /Cancel call/i })).toBeVisible();
  await expect(alicePage.getByRole('button', { name: /Mute|Unmute/ })).toBeVisible();
  await expect(alicePage.getByRole('button', { name: /camera/i })).toBeVisible();

  // Outgoing ringback tone is active.
  await expect(alicePage.getByTestId('call-tone')).toHaveAttribute('data-tone', 'outgoing');

  await aliceContext.close();
});

test('an unanswered call ends instead of ringing forever', async ({ browser }) => {
  const aliceContext = await browser.newContext();

  await authenticate(aliceContext, alice);
  await installFakeMedia(aliceContext);
  // Comfortable window so a cold page-load doesn't tear the surface down
  // before the first visibility poll, while still well under the 30s default.
  await setCallTimeout(aliceContext, 4000);

  const alicePage = await aliceContext.newPage();
  await alicePage.goto(`/messages/${bob.user.id}`);
  await expect(alicePage.getByRole('button', { name: /Open .*profile/i })).toBeVisible();
  await alicePage.getByRole('button', { name: 'Start video call' }).click();

  const surface = alicePage.getByTestId('outgoing-call');
  await expect(surface).toBeVisible();

  // After the timeout the surface (and tone) tear down — no endless ringing.
  await expect(surface).toBeHidden({ timeout: 8000 });
  await expect(alicePage.getByTestId('call-tone')).toHaveCount(0);

  await aliceContext.close();
});

test('blocked media shows an error and never leaves a fake ringing state', async ({
  browser,
}) => {
  const aliceContext = await browser.newContext();

  await authenticate(aliceContext, alice);
  await installBlockedMedia(aliceContext);

  const alicePage = await aliceContext.newPage();
  await alicePage.goto(`/messages/${bob.user.id}`);
  await expect(alicePage.getByRole('button', { name: /Open .*profile/i })).toBeVisible();
  await alicePage.getByRole('button', { name: 'Start video call' }).click();

  // Media acquisition failed: an honest error, no lingering ring, no tone.
  await expect(alicePage.getByText('Camera and microphone access was blocked')).toBeVisible();
  await expect(alicePage.getByTestId('outgoing-call')).toHaveCount(0);
  await expect(alicePage.getByTestId('call-tone')).toHaveCount(0);

  await aliceContext.close();
});

test('an unanswered call times out and ends cleanly on both devices', async ({
  browser,
}) => {
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();

  await authenticate(aliceContext, alice);
  await authenticate(bobContext, bob);
  await installFakeMedia(aliceContext);
  await installFakeMedia(bobContext);
  // Only the caller has a short timeout — the recipient must end purely via
  // the relayed call:end, proving the cross-device cleanup. The window is kept
  // comfortable so a cold page-load doesn't race the visibility assertions.
  await setCallTimeout(aliceContext, 4000);

  const alicePage = await aliceContext.newPage();
  const bobPage = await bobContext.newPage();
  await bobPage.goto('/discover');
  await expect(bobPage.getByRole('heading', { name: 'Nearby discovery map' })).toBeAttached();
  await alicePage.goto(`/messages/${bob.user.id}`);
  await expect(alicePage.getByRole('button', { name: /Open .*profile/i })).toBeVisible();
  await alicePage.getByRole('button', { name: 'Start video call' }).click();

  // Both ends are live: caller ringing, recipient ringing.
  await expect(alicePage.getByTestId('outgoing-call')).toBeVisible();
  await expect(bobPage.getByText('Incoming call...')).toBeVisible();

  // After the caller's timeout, both surfaces (and tones) tear down cleanly.
  await expect(alicePage.getByTestId('outgoing-call')).toBeHidden({ timeout: 8000 });
  await expect(alicePage.getByTestId('call-tone')).toHaveCount(0);
  await expect(bobPage.getByText('Incoming call...')).toBeHidden({ timeout: 8000 });
  await expect(bobPage.getByTestId('call-tone')).toHaveCount(0);

  await aliceContext.close();
  await bobContext.close();
});

test('cancelling the call stops the outgoing tone immediately', async ({ browser }) => {
  const aliceContext = await browser.newContext();

  await authenticate(aliceContext, alice);
  await installFakeMedia(aliceContext);

  const alicePage = await aliceContext.newPage();
  await alicePage.goto(`/messages/${bob.user.id}`);
  await expect(alicePage.getByRole('button', { name: /Open .*profile/i })).toBeVisible();
  await alicePage.getByRole('button', { name: 'Start video call' }).click();

  const surface = alicePage.getByTestId('outgoing-call');
  await expect(surface).toBeVisible();
  await expect(alicePage.getByTestId('call-tone')).toHaveAttribute('data-tone', 'outgoing');

  // Cancelling ends the call and tears down the tone — no lingering ringback.
  await alicePage.getByRole('button', { name: /Cancel call/i }).click();
  await expect(surface).toBeHidden();
  await expect(alicePage.getByTestId('call-tone')).toHaveCount(0);

  await aliceContext.close();
});

test('an incoming call rings while the recipient is on discovery', async ({ browser }) => {
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();

  await authenticate(aliceContext, alice);
  await authenticate(bobContext, bob);
  await installFakeMedia(aliceContext);
  await installFakeMedia(bobContext);

  const alicePage = await aliceContext.newPage();
  const bobPage = await bobContext.newPage();
  await bobPage.goto('/discover');
  await expect(bobPage.getByRole('heading', { name: 'Nearby discovery map' })).toBeAttached();
  await alicePage.goto(`/messages/${bob.user.id}`);
  await expect(alicePage.getByRole('button', { name: /Open .*profile/i })).toBeVisible();
  await alicePage.getByRole('button', { name: 'Start video call' }).click();

  await expect(bobPage.getByText('Incoming call...')).toBeVisible();
  await expect(
    bobPage.getByText('Incoming call...').locator('..').getByText('Alice', { exact: true }),
  ).toBeVisible();

  // Distinct incoming ringtone is active on the recipient.
  await expect(bobPage.getByTestId('call-tone')).toHaveAttribute('data-tone', 'incoming');

  await aliceContext.close();
  await bobContext.close();
});
