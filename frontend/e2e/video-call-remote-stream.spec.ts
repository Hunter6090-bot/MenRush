/**
 * 1:1 video call — the remote stream must actually render (issue #73).
 *
 * Unlike video-call.spec.ts (FakePeerConnection, ringing/timeout only), this
 * runs two real Chromium RTCPeerConnections with fake camera devices. The API
 * is mocked and Socket.IO signalling is relayed between the two pages, so no
 * live backend is required. A missing remote stream fails the test.
 */
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
  type WebSocketRoute,
} from '@playwright/test';
import { PLAYWRIGHT_BASE_URL as BASE_URL } from './support/base-url';

test.use({
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  },
  permissions: ['microphone', 'camera'],
});

type Person = {
  token: string;
  user: { id: string; email: string; name: string; is_verified: boolean; verification_status: string };
};

const CALLER: Person = {
  token: 'e2ecallerpayload.e2ecallersig000000000000',
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'caller@test.menrush',
    name: 'Caller',
    is_verified: true,
    verification_status: 'approved',
  },
};

const CALLEE: Person = {
  token: 'e2ecalleepayload.e2ecalleesig000000000000',
  user: {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'callee@test.menrush',
    name: 'Callee',
    is_verified: true,
    verification_status: 'approved',
  },
};

async function authenticate(context: BrowserContext, person: Person) {
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('menrush_install_prompt_dismissed', '1');
  }, person);
}

async function mockApi(page: Page, me: Person, peer: Person) {
  await page.route(
    (url) => url.pathname === '/api' || url.pathname.startsWith('/api/'),
    async (route) => {
      const p = new URL(route.request().url()).pathname;
      const json = (body: unknown) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

      if (p.endsWith('/webrtc/ice-servers')) {
        // Same-machine call: host candidates are enough, no STUN/TURN round trip.
        return json({ iceServers: [{ urls: 'stun:127.0.0.1:3478' }], turn: 'missing' });
      }
      if (p.endsWith('/users/me')) {
        return json({
          ...me.user,
          photo_url: '/avatars/generic/02.svg',
          bio: 'Nearby for real — clear face, clear intent, no waiting around.',
          looking_for: 'Chat and meet',
          interests: ['Chat', 'Fitness', 'Nightlife'],
          lat: 51.5,
          lng: -0.12,
          age: 32,
          onboarding_complete: true,
        });
      }
      if (p === `/api/users/${peer.user.id}` || p.includes(`/users/profile/${peer.user.id}`)) {
        return json({ id: peer.user.id, name: peer.user.name, photo_url: null, online: true });
      }
      if (p.includes('/messages/conversation/') || p.includes('/notifications') || p.includes('/conversations')) {
        return json([]);
      }
      if (p.includes('/messages/unread')) return json({ total: 0, bySender: {} });
      if (p.includes('/meet/')) return json(null);
      return json({});
    },
  );
}

/**
 * Minimal Socket.IO (engine.io v4) server over Playwright's WebSocket routing.
 * Mirrors backend/src/server.ts call:* relays between the two signed-in pages.
 */
class SignalRelay {
  private sockets = new Map<string, WebSocketRoute>();
  private answered = false;
  /** ICE candidates actually delivered, keyed by recipient user id. */
  readonly iceDelivered = new Map<string, number>();

  /**
   * `loseEarlyCallerIce` reproduces the callee-was-offline path: everything the
   * caller trickles before the answer never reaches the callee.
   */
  constructor(private options: { loseEarlyCallerIce?: boolean } = {}) {}

  async attach(page: Page, me: Person) {
    // Force the websocket transport: fail the polling probe.
    await page.route(/\/socket\.io\/.*transport=polling/, (route) => route.abort());
    await page.routeWebSocket(/\/socket\.io\//, (ws) => {
      this.sockets.set(me.user.id, ws);
      ws.send('0{"sid":"e2e","upgrades":[],"pingInterval":25000,"pingTimeout":60000,"maxPayload":1000000}');
      ws.onMessage((raw) => {
        const msg = String(raw);
        if (msg === '2') return ws.send('3');
        if (msg.startsWith('40')) return ws.send('40{"sid":"e2e"}');
        if (!msg.startsWith('42')) return;
        const [event, data] = JSON.parse(msg.slice(2)) as [string, any];
        this.handle(me, ws, event, data);
      });
    });
  }

  private emit(userId: string, event: string, data: unknown) {
    this.sockets.get(userId)?.send(`42${JSON.stringify([event, data])}`);
  }

  private handle(me: Person, ws: WebSocketRoute, event: string, data: any) {
    const from = me.user.id;
    if (event === 'authenticate') {
      ws.send(`42${JSON.stringify(['authenticated', { userId: from }])}`);
    } else if (event === 'call:initiate') {
      this.emit(data.to, 'call:incoming', { from, fromName: me.user.name, offer: data.offer });
    } else if (event === 'call:answer') {
      this.answered = true;
      this.emit(data.to, 'call:answered', { from, answer: data.answer });
    } else if (event === 'call:ice-candidate') {
      if (this.options.loseEarlyCallerIce && !this.answered) return;
      this.iceDelivered.set(data.to, (this.iceDelivered.get(data.to) ?? 0) + 1);
      this.emit(data.to, 'call:ice-candidate', { from, candidate: data.candidate });
    } else if (event === 'call:end') {
      this.emit(data.to, 'call:ended', { from });
    } else if (event === 'call:reject') {
      this.emit(data.to, 'call:rejected', { from });
    }
  }
}

/** The main call <video> is bound to a stream and has decoded real frames. */
async function expectRemoteVideoPlaying(page: Page) {
  const surface = page.getByTestId('connected-call');
  await expect(surface).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const video = document.querySelector<HTMLVideoElement>(
            '[data-testid="connected-call"] > video',
          );
          const stream = video?.srcObject as MediaStream | null;
          return {
            hasStream: Boolean(stream),
            videoTracks: stream?.getVideoTracks().length ?? 0,
            width: video?.videoWidth ?? 0,
            paused: video?.paused ?? true,
          };
        }),
      { timeout: 20_000, message: 'remote stream never attached to the main call video' },
    )
    .toMatchObject({ hasStream: true, videoTracks: 1, paused: false, width: expect.any(Number) });
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document.querySelector<HTMLVideoElement>('[data-testid="connected-call"] > video')
              ?.videoWidth ?? 0,
        ),
      { timeout: 20_000, message: 'remote video never decoded a frame (black video)' },
    )
    .toBeGreaterThan(0);
  await expect(page.getByTestId('remote-waiting')).toHaveCount(0);
}

async function placeCall(browser: Browser, relay: SignalRelay) {
  const viewport = { width: 390, height: 844 };
  const callerContext = await browser.newContext({ viewport });
  const calleeContext = await browser.newContext({ viewport });
  await authenticate(callerContext, CALLER);
  await authenticate(calleeContext, CALLEE);

  const callerPage = await callerContext.newPage();
  const calleePage = await calleeContext.newPage();
  await mockApi(callerPage, CALLER, CALLEE);
  await mockApi(calleePage, CALLEE, CALLER);
  await relay.attach(callerPage, CALLER);
  await relay.attach(calleePage, CALLEE);

  await calleePage.goto(`${BASE_URL}/messages/${CALLER.user.id}`);
  await callerPage.goto(`${BASE_URL}/messages/${CALLEE.user.id}`);
  await expect(calleePage.getByRole('button', { name: 'Start video call' })).toBeVisible({
    timeout: 20_000,
  });
  await callerPage.getByRole('button', { name: 'Start video call' }).click();
  await calleePage.getByRole('button', { name: 'Accept call' }).click({ timeout: 20_000 });

  return {
    callerPage,
    calleePage,
    close: async () => {
      await callerContext.close();
      await calleeContext.close();
    },
  };
}

test('both people in a 1:1 call see the other person, not just themselves', async ({ browser }) => {
  const call = await placeCall(browser, new SignalRelay());

  await expectRemoteVideoPlaying(call.callerPage);
  await expectRemoteVideoPlaying(call.calleePage);

  await call.close();
});

test('the callee still gets the caller\'s ICE when the early candidates were lost', async ({
  browser,
}) => {
  const relay = new SignalRelay({ loseEarlyCallerIce: true });
  const call = await placeCall(browser, relay);

  // Without the caller's candidates the callee has no TURN permission / NAT
  // pinhole for him, so a cross-network call never connects. The caller must
  // re-send them once the answer proves the callee is online.
  await expect
    .poll(() => relay.iceDelivered.get(CALLEE.user.id) ?? 0, {
      timeout: 20_000,
      message: 'callee never received any of the caller\'s ICE candidates',
    })
    .toBeGreaterThan(0);

  await expectRemoteVideoPlaying(call.callerPage);
  await expectRemoteVideoPlaying(call.calleePage);

  await call.close();
});
