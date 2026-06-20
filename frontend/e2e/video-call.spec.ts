import { expect, test, type BrowserContext } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

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
  request,
}) => {
  const alice = await login(request, 'alice@example.com');
  const bob = await login(request, 'bob@example.com');
  await authenticate(page.context(), alice);

  await page.goto(`http://192.168.10.116:5173/messages/${bob.user.id}`);
  await page.getByRole('button', { name: 'Start video call' }).click();

  await expect(page.getByText('Video calls need HTTPS')).toBeVisible();
  await expect(page.getByText('Calling Bob')).not.toBeVisible();
});

test('an incoming call rings while the recipient is on discovery', async ({ browser, request }) => {
  const alice = await login(request, 'alice@example.com');
  const bob = await login(request, 'bob@example.com');
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
  await alicePage.getByRole('button', { name: 'Start video call' }).click();

  await expect(bobPage.getByText('Incoming call...')).toBeVisible();
  await expect(
    bobPage.getByText('Incoming call...').locator('..').getByText('Alice', { exact: true }),
  ).toBeVisible();

  await aliceContext.close();
  await bobContext.close();
});
