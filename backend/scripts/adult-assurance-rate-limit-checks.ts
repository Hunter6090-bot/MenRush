/**
 * Adult-assurance status-poll rate limit — offline checks.
 *
 * Proves GET /adult-assurance/:sessionId uses a dedicated high ceiling
 * (enough for a full Register poll loop) and does not share the tight
 * mutation / auth limiters. No provider calls. No DB.
 */
import assert from 'assert';
import fs from 'fs';
import http from 'http';
import path from 'path';
import express from 'express';
import rateLimit from 'express-rate-limit';

process.env.NODE_ENV = 'production';

const AUTH_ROUTE = path.join(__dirname, '../src/routes/auth.ts');
const FLOW_PAGE = path.join(
  __dirname,
  '../../frontend/src/components/AdultAssuranceFlow.tsx',
);

async function listen(app: express.Express): Promise<{
  port: number;
  close: () => Promise<void>;
}> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('no port');
  return {
    port: addr.port,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

async function getStatus(port: number, pathName: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: pathName, method: 'GET' },
      (res) => {
        res.resume();
        resolve(res.statusCode || 0);
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function postStatus(port: number, pathName: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: pathName,
        method: 'POST',
        headers: { 'Content-Length': 0 },
      },
      (res) => {
        res.resume();
        resolve(res.statusCode || 0);
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const authSrc = fs.readFileSync(AUTH_ROUTE, 'utf8');
  const flowSrc = fs.readFileSync(FLOW_PAGE, 'utf8');

  // Frontend poll budget the limiter must cover (AdultAssuranceFlow).
  assert.match(flowSrc, /ADULT_POLL_MS\s*=\s*2000/);
  assert.match(flowSrc, /ADULT_POLL_MAX_MS\s*=\s*120_000/);

  // Wiring: status GET must use the dedicated poll limiter, not the mutation one.
  assert.match(authSrc, /adultAssuranceStatusPollLimiter/);
  assert.match(
    authSrc,
    /router\.get\(\s*'\/adult-assurance\/:sessionId'\s*,\s*adultAssuranceStatusPollLimiter/,
  );
  assert.doesNotMatch(
    authSrc,
    /router\.get\(\s*'\/adult-assurance\/:sessionId'\s*,\s*adultAssuranceLimiter/,
  );
  assert.match(
    authSrc,
    /router\.post\(\s*'\/adult-assurance\/start'\s*,\s*adultAssuranceLimiter/,
  );
  assert.match(
    authSrc,
    /router\.post\(\s*'\/adult-assurance\/:sessionId\/start-id'\s*,\s*adultAssuranceLimiter/,
  );
  assert.match(
    authSrc,
    /router\.post\(\s*'\/adult-assurance\/:sessionId\/submitted'\s*,\s*adultAssuranceLimiter/,
  );
  assert.match(
    authSrc,
    /router\.post\(\s*'\/register'\s*,\s*authLimiter/,
  );

  // Production ceilings in source (keep auth / mutation tight).
  assert.match(
    authSrc,
    /const authLimiter = rateLimit\(\{[\s\S]*?max:\s*process\.env\.NODE_ENV === 'production' \? 10/,
  );
  assert.match(
    authSrc,
    /const adultAssuranceLimiter = rateLimit\(\{[\s\S]*?max:\s*process\.env\.NODE_ENV === 'production' \? 12/,
  );
  assert.match(
    authSrc,
    /const adultAssuranceStatusPollLimiter = rateLimit\(\{[\s\S]*?max:\s*process\.env\.NODE_ENV === 'production' \? 120/,
  );

  // Live middleware: one full signup poll sequence (~60) must not 429;
  // mutation bucket still trips at 13; register/login bucket still at 11.
  const pollLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    message: { error: 'Too many age-check status polls, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  const mutationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 12,
    message: { error: 'Too many adult-assurance attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many attempts, please try again in 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const app = express();
  app.get('/poll', pollLimiter, (_req, res) => res.json({ ok: true }));
  app.post('/mutate', mutationLimiter, (_req, res) => res.json({ ok: true }));
  app.post('/register', authLimiter, (_req, res) => res.json({ ok: true }));

  const { port, close } = await listen(app);
  try {
    // 60 polls = one full ADULT_POLL_MAX window; 70 covers start+submitted noise + margin.
    for (let i = 0; i < 70; i++) {
      const code = await getStatus(port, '/poll');
      assert.equal(code, 200, `status poll #${i + 1} should be 200, got ${code}`);
    }
    // Still under 120 ceiling.
    const stillOk = await getStatus(port, '/poll');
    assert.equal(stillOk, 200);

    for (let i = 0; i < 12; i++) {
      const code = await postStatus(port, '/mutate');
      assert.equal(code, 200, `mutation #${i + 1} should be 200, got ${code}`);
    }
    const mutate429 = await postStatus(port, '/mutate');
    assert.equal(mutate429, 429, 'mutation limiter must still 429 after 12');

    for (let i = 0; i < 10; i++) {
      const code = await postStatus(port, '/register');
      assert.equal(code, 200, `register #${i + 1} should be 200, got ${code}`);
    }
    const register429 = await postStatus(port, '/register');
    assert.equal(register429, 429, 'authLimiter must still 429 after 10');
  } finally {
    await close();
  }

  console.log('adult-assurance-rate-limit-checks: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
