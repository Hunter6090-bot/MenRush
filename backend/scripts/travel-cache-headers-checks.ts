/**
 * Travel GETs keep 'private, no-store' (set by privateNoStore on the router).
 * No route may override it with a plain 'no-store'. Runs the real router's
 * layers with stubbed auth and service calls; no database or network.
 *   npx ts-node scripts/travel-cache-headers-checks.ts
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import path from 'path';

// Auth is stubbed below; the module only needs a value to load.
process.env.JWT_SECRET ||= 'travel-cache-headers-checks-placeholder';

async function main() {
  const { PRIVATE_NO_STORE } = await import('../src/middleware/noStore');
  const { travelService } = await import('../src/services/travel.service');
  const { default: router } = await import('../src/routes/travel');

  // Stub the service so the handlers succeed without a database.
  (travelService as any).lookAround = async () => ({ place: { name: 'Manchester' }, members: [] });
  (travelService as any).getTrip = async () => null;

  const stack: any[] = (router as any).stack;
  // Router-level middleware: keep privateNoStore, skip auth (stubbed caller).
  const routerUse = stack.filter((l) => !l.route).map((l) => l.handle);
  const noStoreMw = routerUse.find((fn: any) => fn.name === 'privateNoStore');
  assert.ok(noStoreMw, 'router uses privateNoStore');

  async function run(routePath: string): Promise<string | undefined> {
    const layer = stack.find((l) => l.route && l.route.path === routePath && l.route.methods.get);
    assert.ok(layer, `GET ${routePath} exists`);
    const headers: Record<string, string> = {};
    let done!: () => void;
    const finished = new Promise<void>((r) => (done = r));
    const res: any = {
      statusCode: 200,
      setHeader(k: string, v: string) { headers[k.toLowerCase()] = v; },
      getHeader(k: string) { return headers[k.toLowerCase()]; },
      status(c: number) { this.statusCode = c; return this; },
      json(_b: unknown) { done(); return this; },
    };
    const req: any = { userId: 'u-1', query: { city: 'Manchester' }, ip: '127.0.0.1', headers: {}, app: { get: () => undefined } };
    noStoreMw(req, res, () => undefined);
    // Final handler only (rate limiters are not under test here).
    const handlers = layer.route.stack.map((s: any) => s.handle);
    await handlers[handlers.length - 1](req, res, () => undefined);
    await finished;
    assert.strictEqual(res.statusCode, 200, `GET ${routePath} ok`);
    return headers['cache-control'];
  }

  assert.strictEqual(await run('/look-around'), PRIVATE_NO_STORE, "look-around keeps 'private, no-store'");
  console.log("ok - GET /travel/look-around sends 'private, no-store'");
  assert.strictEqual(await run('/trip'), PRIVATE_NO_STORE, "trip keeps 'private, no-store'");
  console.log("ok - GET /travel/trip sends 'private, no-store'");

  const src = readFileSync(path.join(__dirname, '../src/routes/travel.ts'), 'utf8');
  assert.ok(!/setHeader\(\s*['"]Cache-Control['"]\s*,\s*['"]no-store['"]/.test(src), 'no plain no-store override');
  console.log('ok - no plain no-store override in routes/travel.ts');
  console.log('travel-cache-headers: 3 passed');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
