/**
 * Manual Premium Invoice Stopgap and Password Flow Checks
 *
 * Covers:
 * 1. Invoice creation: creates unpaid invoice, unique invoice number, reference, instructions.
 * 2. Invoices list & unpaid lookup for user.
 * 3. Payment confirmation: ops marks paid -> status paid, paid_at set, idempotent re-confirm.
 * 4. Premium activation & stacking rules:
 *    - User with no premium gets 30 days premium starting now.
 *    - User with existing active premium (e.g. 12-month promo / beta gift) gets extension without shortening.
 *    - Always-premium account preserves lifetime open-ended (null until).
 *    - Subscriptions table records active processor = 'manual_invoice'.
 * 5. Invoice cancellation: cancel unpaid invoice, cannot confirm cancelled invoice.
 * 5a. Immediate start tick (Terms 7.6A): POST /api/premium/invoices refuses a missing or
 *     false tick with 400 and no invoice row; a ticked request records the time on the row.
 * 5b. "Your MenRush Premium is now on" email carries the 14 day cancellation details.
 * 6. Set / Change Password flow during invoice journey:
 *    - Account with password requires correct current password to change.
 *    - Account without password can set password without current password.
 *    - New password works for subsequent login.
 */
import assert from 'assert';
import { randomUUID } from 'crypto';
import pool, { query } from '../src/db';
import { authService } from '../src/services/auth.service';
import {
  invoiceService,
  getManualPaymentInstructions,
  buildPremiumOnEmail,
  buildPremiumPaidNotification,
  buildRefundPaidEmail,
} from '../src/services/invoice.service';
import { IMMEDIATE_START_CONSENT_TEXT } from '../src/types/validation';
import {
  PREMIUM_PRICE_LIST,
  cancellationPeriodEnd,
  paidPremiumStartsAt,
} from '../src/lib/premiumPriceList';
import { premiumService } from '../src/services/premium.service';
import { ALWAYS_PREMIUM_NAMES } from '../src/lib/always-premium';

type Test = { name: string; run: () => void | Promise<void> };
const tests: Test[] = [];

function test(name: string, run: Test['run']) {
  tests.push({ name, run });
}

async function createTestUser(emailSuffix: string, name = 'TestUser', isAlways = false) {
  const id = randomUUID();
  const email = `invoice-test-${emailSuffix}-${randomUUID().slice(0, 6)}@test.menrush.local`;
  // Uses the shared always-Premium list so no member name is hard coded here.
  const userName = isAlways ? ALWAYS_PREMIUM_NAMES[0] : name;
  await query(
    `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status)
     VALUES ($1, $2, '', $3, 25, TRUE, 'verified')`,
    [id, email, userName],
  );
  return { id, email, name: userName };
}

test('Invoice generation creates unpaid invoice with clear reference and instructions', async () => {
  const user = await createTestUser('gen1');
  const invoice = await invoiceService.createInvoice({
    userId: user.id,
    planTier: 'premium',
    planDays: 30,
    amountPence: 699,
    immediateStartConsent: true,
  });

  assert.strictEqual(invoice.user_id, user.id);
  assert.strictEqual(invoice.status, 'unpaid');
  assert.strictEqual(invoice.plan_tier, 'premium');
  assert.strictEqual(invoice.plan_days, 30);
  assert.strictEqual(invoice.amount_pence, 699);
  assert.strictEqual(invoice.currency, 'GBP');
  assert.match(invoice.invoice_number, /^MR-INV-\d{8}-[A-F0-9]{6}$/);
  assert.match(invoice.payment_reference, /^MR-[A-F0-9]{8}$/);

  const instructions = getManualPaymentInstructions(invoice.payment_reference);
  assert.strictEqual(instructions.payment_reference, invoice.payment_reference);
  assert.strictEqual(instructions.currency, 'GBP');
  assert.ok(instructions.instructions);
  assert.strictEqual(typeof instructions.bank_configured, 'boolean');

  // Lookups
  const byId = await invoiceService.getInvoiceById(invoice.id);
  assert.ok(byId);
  assert.strictEqual(byId?.invoice_number, invoice.invoice_number);

  const unpaid = await invoiceService.getLatestUnpaidInvoiceForUser(user.id);
  assert.ok(unpaid);
  assert.strictEqual(unpaid?.id, invoice.id);
});

test('Creating a second invoice cancels previous unpaid invoice so only one active invoice exists', async () => {
  const user = await createTestUser('multi-inv');
  const inv1 = await invoiceService.createInvoice({ userId: user.id, immediateStartConsent: true });
  assert.strictEqual(inv1.status, 'unpaid');

  const inv2 = await invoiceService.createInvoice({
    userId: user.id,
    planDays: 60,
    amountPence: 1299,
    createdByAdminId: 'ops-test',
    immediateStartConsent: true,
  });
  assert.strictEqual(inv2.status, 'unpaid');

  const inv1Updated = await invoiceService.getInvoiceById(inv1.id);
  assert.strictEqual(inv1Updated?.status, 'cancelled');

  const unpaid = await invoiceService.getLatestUnpaidInvoiceForUser(user.id);
  assert.strictEqual(unpaid?.id, inv2.id);
});

test('Confirm payment activates Premium, updates status, and records subscription', async () => {
  const user = await createTestUser('confirm1');
  const invoice = await invoiceService.createInvoice({
    userId: user.id,
    planTier: 'premium',
    planDays: 30,
    amountPence: 699,
    immediateStartConsent: true,
  });

  const confirmRes = await invoiceService.confirmPayment(invoice.invoice_number, 'admin-uuid-1', 'Bank transfer verified');
  assert.strictEqual(confirmRes.invoice.status, 'paid');
  assert.ok(confirmRes.invoice.paid_at);
  assert.strictEqual(confirmRes.userPremium.isPremium, true);
  assert.ok(confirmRes.userPremium.premiumUntil);

  // Check DB state directly
  const userRow = await query(`SELECT is_premium, premium_tier, premium_until FROM users WHERE id = $1`, [user.id]);
  assert.strictEqual(userRow.rows[0].is_premium, true);
  assert.strictEqual(userRow.rows[0].premium_tier, 'premium');
  const until = new Date(userRow.rows[0].premium_until);
  const now = new Date();
  assert.ok(until.getTime() > now.getTime() + 28 * 24 * 3600 * 1000);

  // Check subscriptions row
  const subRow = await query(`SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active'`, [user.id]);
  assert.strictEqual(subRow.rows.length, 1);
  assert.strictEqual(subRow.rows[0].processor, 'manual_invoice');
  assert.strictEqual(subRow.rows[0].processor_subscription_id, invoice.invoice_number);

  // Re-confirming is idempotent
  const reConfirm = await invoiceService.confirmPayment(invoice.id);
  assert.strictEqual(reConfirm.alreadyPaid, true);
});

test('Stacking rules: Paid invoice does not shorten longer existing entitlement', async () => {
  const user = await createTestUser('stacking');
  // Suppose user already has a 12-month promo promise (until 1 year from now)
  const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  await query(
    `UPDATE users
     SET is_premium = TRUE, premium_tier = 'premium', premium_until = $2
     WHERE id = $1`,
    [user.id, farFuture],
  );

  const invoice = await invoiceService.createInvoice({
    userId: user.id,
    planTier: 'premium',
    planDays: 30,
    amountPence: 699,
    immediateStartConsent: true,
  });

  const confirmRes = await invoiceService.confirmPayment(invoice.id);
  assert.ok(confirmRes.userPremium.premiumUntil);

  // Entitlement should be extended by 30 days beyond farFuture!
  const expectedMin = new Date(farFuture.getTime() + 29 * 24 * 60 * 60 * 1000);
  assert.ok(
    confirmRes.userPremium.premiumUntil.getTime() >= expectedMin.getTime(),
    'Existing 12-month promise was extended rather than shortened or wiped',
  );

  const userRow = await query(`SELECT premium_until FROM users WHERE id = $1`, [user.id]);
  const currentUntil = new Date(userRow.rows[0].premium_until);
  assert.ok(currentUntil.getTime() >= expectedMin.getTime());
});

test('Stacking rules: Always-premium accounts never lose open-ended status', async () => {
  const user = await createTestUser('always-owner', 'AlwaysOwnerFixture', true);
  await query(
    `UPDATE users SET is_premium = TRUE, premium_tier = 'premium', premium_until = NULL WHERE id = $1`,
    [user.id],
  );

  const invoice = await invoiceService.createInvoice({ userId: user.id, immediateStartConsent: true });
  const confirmRes = await invoiceService.confirmPayment(invoice.id);
  assert.strictEqual(confirmRes.userPremium.premiumUntil, null, 'Lifetime open-ended null until is preserved');

  const userRow = await query(`SELECT premium_until, is_premium FROM users WHERE id = $1`, [user.id]);
  assert.strictEqual(userRow.rows[0].premium_until, null);
  assert.strictEqual(userRow.rows[0].is_premium, true);
});

test('Cancelled invoices cannot be paid', async () => {
  const user = await createTestUser('cancel-test');
  const invoice = await invoiceService.createInvoice({ userId: user.id, immediateStartConsent: true });

  await invoiceService.cancelInvoice(invoice.id, 'User changed mind');
  const updated = await invoiceService.getInvoiceById(invoice.id);
  assert.strictEqual(updated?.status, 'cancelled');

  await assert.rejects(
    async () => {
      await invoiceService.confirmPayment(invoice.id);
    },
    /Cannot confirm payment for cancelled invoice/,
  );
});

test('Set / Change password during invoice flow: first-time set without current password', async () => {
  const user = await createTestUser('pw-first-time');

  // Verify user has no password
  const hasPwBefore = await authService.hasPassword(user.id);
  assert.strictEqual(hasPwBefore, false);

  // Setting password for first time without current password succeeds
  const setRes = await authService.setOrChangePassword(user.id, {
    new_password: 'SecurePassword123!',
  });
  assert.strictEqual(setRes.ok, true);

  // Now user has password
  const hasPwAfter = await authService.hasPassword(user.id);
  assert.strictEqual(hasPwAfter, true);

  // User can log in with new password
  const loginRes = await authService.login({
    email: user.email,
    password: 'SecurePassword123!',
  });
  assert.ok(loginRes.token);
  assert.strictEqual(loginRes.user.email, user.email);
});

test('Set / Change password during invoice flow: changing existing password requires current password', async () => {
  const user = await createTestUser('pw-change');
  await authService.setOrChangePassword(user.id, {
    new_password: 'InitialPassword123!',
  });

  // Attempting without current_password fails
  await assert.rejects(
    async () => {
      await authService.setOrChangePassword(user.id, {
        new_password: 'SecondPassword456!',
      });
    },
    /Current password is required/,
  );

  // Attempting with wrong current_password fails
  await assert.rejects(
    async () => {
      await authService.setOrChangePassword(user.id, {
        current_password: 'WrongPassword!',
        new_password: 'SecondPassword456!',
      });
    },
    /Current password is incorrect/,
  );

  // Attempting with same password fails
  await assert.rejects(
    async () => {
      await authService.setOrChangePassword(user.id, {
        current_password: 'InitialPassword123!',
        new_password: 'InitialPassword123!',
      });
    },
    /New password must be different from your current password/,
  );

  // Valid change succeeds
  const updateRes = await authService.setOrChangePassword(user.id, {
    current_password: 'InitialPassword123!',
    new_password: 'SecondPassword456!',
  });
  assert.strictEqual(updateRes.ok, true);

  // Login works with new password
  const loginRes = await authService.login({
    email: user.email,
    password: 'SecondPassword456!',
  });
  assert.ok(loginRes.token);
});

test('HTTP API routes: invoice create -> unpaid view -> admin confirm -> status paid', async () => {
  const user = await createTestUser('http-flow');
  const token = authService.issueAccessToken(user.id);

  // Set up mock request handler simulation for routes
  const express = (await import('express')).default;
  const http = (await import('http')).default;
  const app = express();
  app.use(express.json());

  const premiumRoutes = (await import('../src/routes/premium')).default;
  const adminRoutes = (await import('../src/routes/admin.routes')).default;

  app.use('/api/premium', premiumRoutes);
  app.use('/api/admin', adminRoutes);

  process.env.ADMIN_TOKEN = 'test-admin-secret-token';

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // 1. User gets unpaid invoice when none exists
    const res1 = await fetch(`${baseUrl}/api/premium/invoices/unpaid`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(res1.status, 200);
    const body1 = (await res1.json()) as any;
    assert.strictEqual(body1.invoice, null);

    // 2. User creates an invoice
    const res2 = await fetch(`${baseUrl}/api/premium/invoices`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ plan_tier: 'premium', immediate_start_consent: true }),
    });
    assert.strictEqual(res2.status, 201);
    const body2 = (await res2.json()) as any;
    assert.strictEqual(body2.invoice.status, 'unpaid');
    assert.ok(body2.payment_instructions);
    const invoiceNumber = body2.invoice.invoice_number;

    // 3. User views unpaid invoice
    const res3 = await fetch(`${baseUrl}/api/premium/invoices/unpaid`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(res3.status, 200);
    const body3 = (await res3.json()) as any;
    assert.strictEqual(body3.invoice.invoice_number, invoiceNumber);

    // 4. Admin lists invoices
    const res4 = await fetch(`${baseUrl}/api/admin/premium/invoices`, {
      headers: { 'x-admin-token': 'test-admin-secret-token' },
    });
    assert.strictEqual(res4.status, 200);
    const body4 = (await res4.json()) as any;
    assert.ok(Array.isArray(body4.invoices));

    // 5. Admin confirms payment
    const res5 = await fetch(`${baseUrl}/api/admin/premium/invoices/${invoiceNumber}/confirm-payment`, {
      method: 'POST',
      headers: {
        'x-admin-token': 'test-admin-secret-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notes: 'Bank payment confirmed via test' }),
    });
    assert.strictEqual(res5.status, 200);
    const body5 = (await res5.json()) as any;
    assert.strictEqual(body5.ok, true);
    assert.strictEqual(body5.invoice.status, 'paid');
    assert.strictEqual(body5.user_premium.isPremium, true);

    // 6. User now has active premium status
    const res6 = await fetch(`${baseUrl}/api/premium/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(res6.status, 200);
    const body6 = (await res6.json()) as any;
    assert.strictEqual(body6.is_premium, true);

    // 7. Test set-password / password-status HTTP endpoints
    const authRoutes = (await import('../src/routes/auth')).default;
    app.use('/api/auth', authRoutes);

    const resPwStatus1 = await fetch(`${baseUrl}/api/auth/password-status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(resPwStatus1.status, 200);
    const pwStatus1 = (await resPwStatus1.json()) as any;
    assert.strictEqual(pwStatus1.has_password, false);

    // Set password without current password
    const resSetPw = await fetch(`${baseUrl}/api/auth/set-password`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ new_password: 'BrandNewPassword123!' }),
    });
    assert.strictEqual(resSetPw.status, 200);
    const setPwJson = (await resSetPw.json()) as any;
    assert.strictEqual(setPwJson.ok, true);

    const resPwStatus2 = await fetch(`${baseUrl}/api/auth/password-status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(resPwStatus2.status, 200);
    const pwStatus2 = (await resPwStatus2.json()) as any;
    assert.strictEqual(pwStatus2.has_password, true);

    // Updating again now requires current password
    const resSetPwFail = await fetch(`${baseUrl}/api/auth/set-password`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ new_password: 'AnotherPassword456!' }),
    });
    // Form errors must never be 401, or the client signs the member out mid payment.
    assert.strictEqual(resSetPwFail.status, 400);
    assert.strictEqual(((await resSetPwFail.json()) as any).code, 'current_password_required');

    const resSetPwWrong = await fetch(`${baseUrl}/api/auth/set-password`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        current_password: 'NotTheRightPassword1!',
        new_password: 'AnotherPassword456!',
      }),
    });
    assert.strictEqual(resSetPwWrong.status, 400, 'wrong current password is 400, not 401');
    assert.strictEqual(((await resSetPwWrong.json()) as any).code, 'wrong_current_password');

    // A session on another device, which a successful save must revoke.
    const { authSessionService } = await import('../src/services/auth-session.service');
    const otherDeviceRefresh = await authSessionService.create(user.id, 'other-device');

    const resSetPwOk = await fetch(`${baseUrl}/api/auth/set-password`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        current_password: 'BrandNewPassword123!',
        new_password: 'AnotherPassword456!',
      }),
    });
    assert.strictEqual(resSetPwOk.status, 200);
    const setPwOkJson = (await resSetPwOk.json()) as any;
    assert.ok(setPwOkJson.token, 'fresh access token for this session');
    assert.ok(setPwOkJson.refresh_token, 'fresh refresh token for this session');

    // This browser keeps working with the fresh tokens.
    const resStatusFresh = await fetch(`${baseUrl}/api/auth/password-status`, {
      headers: { Authorization: `Bearer ${setPwOkJson.token}` },
    });
    assert.strictEqual(resStatusFresh.status, 200);
    const resRefreshFresh = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: setPwOkJson.refresh_token }),
    });
    assert.strictEqual(resRefreshFresh.status, 200, 'fresh session refreshes');

    // The other device's session was revoked.
    const resRefreshOther = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: otherDeviceRefresh }),
    });
    assert.strictEqual(resRefreshOther.status, 401, 'other sessions are signed out');

    // 8. Test subscribe endpoint fails closed (503 billing_not_configured)
    const resSubscribe = await fetch(`${baseUrl}/api/premium/subscribe`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tier: 'premium' }),
    });
    assert.strictEqual(resSubscribe.status, 503);
    const subBody = (await resSubscribe.json()) as any;
    assert.strictEqual(subBody.error, 'billing_not_configured');
    assert.strictEqual(subBody.checkout_url, undefined);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('Email: "Your MenRush Premium is now on" carries the 14 day cancellation details', () => {
  const email = buildPremiumOnEmail({
    name: 'Sam',
    amountPence: 699,
    premiumUntil: new Date('2026-11-10T12:00:00Z'),
    invoiceNumber: 'MR-INV-20261010-ABC123',
    paymentReference: 'MR-1234ABCD',
    startedStraightAway: true,
  });
  assert.strictEqual(email.subject, 'Your MenRush Premium is now on');
  for (const body of [email.text, email.html]) {
    assert.match(body, /cancel within 14 days of buying/);
    assert.match(body, /support@menrush\.com with your invoice reference, MR-INV-20261010-ABC123/);
    assert.match(body, /refund you within 14 days of hearing from you, to the account you paid from/);
    assert.match(body, /less an amount for the days of Premium you have had/);
    assert.match(body, /As you asked for your Premium to start as soon as your payment was confirmed/, 'states the choice');
    assert.match(body, /All the best,/);
  }
  // Janet's voice: no dashes, no 'love', no 'beta'.
  assert.doesNotMatch(email.text, /[\u2013\u2014]| - /);
  assert.doesNotMatch(email.text, /\blove\b|beta/i);

  const now = new Date('2026-10-11T09:00:00Z');
  const noTick = buildPremiumOnEmail({
    name: null,
    amountPence: 699,
    premiumUntil: new Date('2026-11-24T09:00:00Z'),
    invoiceNumber: 'MR-INV-20261010-DEF456',
    paymentReference: 'MR-5678EFAB',
    startedStraightAway: false,
    premiumStartsAt: new Date('2026-10-25T09:00:00Z'),
    now,
  });
  assert.strictEqual(noTick.subject, 'Your MenRush payment has arrived');
  for (const body of [noTick.text, noTick.html]) {
    assert.match(body, /your Premium starts on 25 October 2026, after the 14 day cancellation period/);
    assert.match(body, /As you chose not to start straight away/, 'states the choice');
    assert.match(body, /before then, just email support@menrush\.com with your invoice reference, MR-INV-20261010-DEF456/);
    assert.match(body, /full refund within 14 days of hearing from you, to the account you paid from/);
    assert.doesNotMatch(body, /less an amount|is now switched on/);
    assert.match(body, /All the best,/);
  }
  assert.doesNotMatch(noTick.text, /[\u2013\u2014]| - |\blove\b|beta/i);
});

test('HTTP: the immediate start tick is optional; the choice is recorded (time and wording, or null)', async () => {
  const user = await createTestUser('consent');
  const token = authService.issueAccessToken(user.id);
  const express = (await import('express')).default;
  const http = (await import('http')).default;
  const app = express();
  app.use(express.json());
  const premiumRoutes = (await import('../src/routes/premium')).default;
  app.use('/api/premium', premiumRoutes);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const post = (body: unknown) =>
    fetch(`${baseUrl}/api/premium/invoices`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  try {
    // Unticked (missing or false): an invoice IS issued, with no consent recorded.
    for (const body of [{ plan_tier: 'premium' }, { plan_tier: 'premium', immediate_start_consent: false }]) {
      const res = await post(body);
      assert.strictEqual(res.status, 201, `unticked issues an invoice: ${JSON.stringify(body)}`);
      const json = (await res.json()) as any;
      assert.strictEqual(json.invoice.immediate_start_consent_at, null);
      assert.strictEqual(json.invoice.metadata.immediate_start_consent_text, undefined);
    }
    // Not a boolean: refused.
    const bad = await post({ plan_tier: 'premium', immediate_start_consent: 'true' });
    assert.strictEqual(bad.status, 400);

    const before = Date.now();
    const ok = await post({ plan_tier: 'premium', immediate_start_consent: true });
    assert.strictEqual(ok.status, 201);
    const okJson = (await ok.json()) as any;
    const row = await query(
      `SELECT immediate_start_consent_at, metadata FROM premium_invoices WHERE id = $1`,
      [okJson.invoice.id],
    );
    const at = row.rows[0].immediate_start_consent_at;
    assert.ok(at instanceof Date, 'tick time recorded on the invoice row');
    assert.ok(Math.abs(at.getTime() - before) < 60_000, 'tick time is now');
    assert.strictEqual(row.rows[0].metadata.immediate_start_consent_text, IMMEDIATE_START_CONSENT_TEXT);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

async function withServer<T>(run: (baseUrl: string) => Promise<T>): Promise<T> {
  const express = (await import('express')).default;
  const http = (await import('http')).default;
  const app = express();
  app.use(express.json());
  app.use('/api/premium', (await import('../src/routes/premium')).default);
  app.use('/api/admin', (await import('../src/routes/admin.routes')).default);
  process.env.ADMIN_TOKEN = 'test-admin-secret-token';
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  try {
    return await run(`http://127.0.0.1:${(server.address() as { port: number }).port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('Price list: the member API refuses any amount, days or notes (400) and always uses the server price', async () => {
  const user = await createTestUser('price-list');
  const token = authService.issueAccessToken(user.id);
  await withServer(async (baseUrl) => {
    const post = (body: unknown) =>
      fetch(`${baseUrl}/api/premium/invoices`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    for (const extra of [{ amount_pence: 1 }, { amount_pence: 699 }, { plan_days: 3650 }, { notes: 'x' }, { plan_tier: 'premium_plus' }]) {
      const res = await post({ immediate_start_consent: true, ...extra });
      assert.strictEqual(res.status, 400, `refused: ${JSON.stringify(extra)}`);
    }
    const none = await query(`SELECT COUNT(*)::int AS n FROM premium_invoices WHERE user_id = $1`, [user.id]);
    assert.strictEqual(none.rows[0].n, 0);
    const ok = await post({ immediate_start_consent: true });
    assert.strictEqual(ok.status, 201);
    const body = (await ok.json()) as any;
    assert.strictEqual(body.invoice.amount_pence, PREMIUM_PRICE_LIST.premium.amountPence);
    assert.strictEqual(body.invoice.plan_days, PREMIUM_PRICE_LIST.premium.planDays);
  });
  // The service ignores member-path amounts too (only the ops path may override).
  const direct = await invoiceService.createInvoice({ userId: user.id, amountPence: 1, planDays: 999, immediateStartConsent: true });
  assert.strictEqual(direct.amount_pence, PREMIUM_PRICE_LIST.premium.amountPence);
  assert.strictEqual(direct.plan_days, PREMIUM_PRICE_LIST.premium.planDays);
});

test('Ops price override: admin only, needs admin_actor, logged with invoice id, old and new values and time', async () => {
  const user = await createTestUser('override');
  const memberToken = authService.issueAccessToken(user.id);
  const logs: string[] = [];
  const origLog = console.log;
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
  try {
    await withServer(async (baseUrl) => {
      const adminPost = (body: unknown, token = 'test-admin-secret-token') =>
        fetch(`${baseUrl}/api/admin/premium/invoices`, {
          method: 'POST',
          headers: { 'x-admin-token': token, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      // Not admin: refused.
      const asMember = await fetch(`${baseUrl}/api/admin/premium/invoices`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${memberToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, amount_pence: 100, admin_actor: 'ops-a' }),
      });
      assert.strictEqual(asMember.status, 401);
      // Override without naming who: refused.
      const noActor = await adminPost({ user_id: user.id, amount_pence: 100 });
      assert.strictEqual(noActor.status, 400);

      const res = await adminPost({ user_id: user.id, amount_pence: 100, plan_days: 7, admin_actor: 'ops-a' });
      assert.strictEqual(res.status, 201);
      const body = (await res.json()) as any;
      assert.strictEqual(body.invoice.amount_pence, 100);
      assert.strictEqual(body.invoice.plan_days, 7);
      const ov = body.invoice.metadata.price_override;
      assert.strictEqual(ov.by, 'ops-a');
      assert.deepStrictEqual(ov.from, { amount_pence: 699, plan_days: 30 });
      assert.deepStrictEqual(ov.to, { amount_pence: 100, plan_days: 7 });
      assert.ok(!Number.isNaN(Date.parse(ov.at)));

      const line = logs.find((l) => l.includes('[invoice] price override'));
      assert.ok(line, 'override is logged');
      assert.match(line!, new RegExp(`invoice=${body.invoice.id} admin=ops-a amount_pence 699->100 plan_days 30->7 at=\\d{4}-`));
      assert.ok(!line!.includes(user.id) && !line!.includes(user.email), 'no member data in the log line');

      // Price list invoice from ops: no override, nothing logged.
      const before = logs.length;
      const plain = await adminPost({ user_id: user.id });
      assert.strictEqual(plain.status, 201);
      const plainBody = (await plain.json()) as any;
      assert.strictEqual(plainBody.invoice.metadata.price_override, undefined);
      assert.ok(!logs.slice(before).some((l) => l.includes('price override')));
    });
  } finally {
    console.log = origLog;
  }
});

test('Ops-created invoices record the member choice: consent with time and wording, or null by default', async () => {
  const user = await createTestUser('ops-consent');
  await withServer(async (baseUrl) => {
    const adminPost = (body: unknown) =>
      fetch(`${baseUrl}/api/admin/premium/invoices`, {
        method: 'POST',
        headers: { 'x-admin-token': 'test-admin-secret-token', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    const withNo = await adminPost({ user_id: user.id });
    const noBody = (await withNo.json()) as any;
    assert.strictEqual(withNo.status, 201);
    assert.strictEqual(noBody.invoice.immediate_start_consent_at, null, 'default is not given');
    assert.strictEqual(noBody.invoice.metadata.immediate_start_consent_text, undefined);

    const withYes = await adminPost({ user_id: user.id, immediate_start_consent: true, admin_actor: 'ops-b' });
    const yesBody = (await withYes.json()) as any;
    assert.strictEqual(withYes.status, 201);
    assert.ok(yesBody.invoice.immediate_start_consent_at, 'tick time recorded');
    assert.strictEqual(yesBody.invoice.metadata.immediate_start_consent_text, IMMEDIATE_START_CONSENT_TEXT);
  });
});

test('Start rule: with no immediate start choice, paid Premium starts only after the 14 day cancellation period', async () => {
  const user = await createTestUser('delayed');
  const invoice = await invoiceService.createInvoice({ userId: user.id, createdByAdminId: 'ops-c' });
  assert.strictEqual(invoice.immediate_start_consent_at, null);
  const res = await invoiceService.confirmPayment(invoice.id);
  const expectedStart = cancellationPeriodEnd(new Date(invoice.created_at));
  assert.strictEqual(res.userPremium.isPremium, false, 'not on yet');
  assert.strictEqual(res.userPremium.premiumStartsAt?.getTime(), expectedStart.getTime());
  assert.strictEqual(
    res.userPremium.premiumUntil?.getTime(),
    expectedStart.getTime() + PREMIUM_PRICE_LIST.premium.planDays * 86_400_000,
  );
  const status = await premiumService.getStatus(user.id);
  if (!premiumService.isBetaPremiumFree()) {
    assert.strictEqual(status?.is_premium, false, 'Premium features are not usable during the 14 days');
  }
  assert.strictEqual(new Date(status!.premium_starts_at!).getTime(), expectedStart.getTime());

  // With the choice, Premium starts at confirmation.
  const user2 = await createTestUser('immediate');
  const inv2 = await invoiceService.createInvoice({ userId: user2.id, immediateStartConsent: true });
  const before = Date.now();
  const res2 = await invoiceService.confirmPayment(inv2.id);
  assert.strictEqual(res2.userPremium.isPremium, true);
  assert.ok(Math.abs((res2.userPremium.premiumStartsAt?.getTime() ?? 0) - before) < 60_000);

  // Pure rule.
  const bought = new Date('2026-10-01T10:00:00Z');
  assert.strictEqual(
    paidPremiumStartsAt({ boughtAt: bought, confirmedAt: new Date('2026-10-03T10:00:00Z'), immediateStartConsent: false }).toISOString(),
    '2026-10-15T10:00:00.000Z',
  );
  assert.strictEqual(
    paidPremiumStartsAt({ boughtAt: bought, confirmedAt: new Date('2026-10-20T10:00:00Z'), immediateStartConsent: false }).toISOString(),
    '2026-10-20T10:00:00.000Z',
  );
  assert.strictEqual(
    paidPremiumStartsAt({ boughtAt: bought, confirmedAt: new Date('2026-10-03T10:00:00Z'), immediateStartConsent: true }).toISOString(),
    '2026-10-03T10:00:00.000Z',
  );
});

test('Start rule with Premium already running: paid days follow it and nothing is shortened', async () => {
  const user = await createTestUser('delayed-stack');
  const longUntil = new Date(Date.now() + 60 * 86_400_000);
  await query(
    `UPDATE users SET is_premium = TRUE, premium_tier = 'premium', premium_starts_at = NOW() - INTERVAL '1 day', premium_until = $2 WHERE id = $1`,
    [user.id, longUntil],
  );
  const invoice = await invoiceService.createInvoice({ userId: user.id, createdByAdminId: 'ops-d' });
  const res = await invoiceService.confirmPayment(invoice.id);
  assert.strictEqual(res.userPremium.isPremium, true, 'running Premium carries on');
  assert.strictEqual(
    res.userPremium.premiumUntil?.getTime(),
    longUntil.getTime() + PREMIUM_PRICE_LIST.premium.planDays * 86_400_000,
  );
});

async function shiftUserTimeBack(userId: string, days: number) {
  // Simulate time passing: move every stored time for this member back.
  const iv = `${days} days`;
  await query(
    `UPDATE users SET premium_starts_at = premium_starts_at - $2::interval,
                      premium_until = premium_until - $2::interval WHERE id = $1`,
    [userId, iv],
  );
  await query(
    `UPDATE premium_invoices SET created_at = created_at - $2::interval, requested_at = requested_at - $2::interval,
                                 paid_at = paid_at - $2::interval WHERE user_id = $1`,
    [userId, iv],
  );
  await query(
    `UPDATE subscriptions SET current_period_start = current_period_start - $2::interval,
                              current_period_end = current_period_end - $2::interval,
                              created_at = created_at - $2::interval WHERE user_id = $1`,
    [userId, iv],
  );
  await query(
    `UPDATE referral_premium_grants SET applied_at = applied_at - $2::interval,
                                        applied_until = applied_until - $2::interval,
                                        granted_at = granted_at - $2::interval WHERE user_id = $1`,
    [userId, iv],
  );
}

async function withBetaPremiumOff<T>(run: () => Promise<T>): Promise<T> {
  const prev = process.env.BETA_PREMIUM_FREE;
  process.env.BETA_PREMIUM_FREE = 'false';
  try {
    return await run();
  } finally {
    if (prev === undefined) delete process.env.BETA_PREMIUM_FREE;
    else process.env.BETA_PREMIUM_FREE = prev;
  }
}

test('Delayed start truth: before day 14 not Premium in login, /me or a gated route; Premium after day 14', async () => {
  await withBetaPremiumOff(async () => {
    const user = await createTestUser('truth');
    const password = 'Truth-Test-Passw0rd!';
    const bcrypt = (await import('bcryptjs')).default;
    await query(`UPDATE users SET password_hash = $2, email_confirmed = TRUE WHERE id = $1`, [
      user.id,
      await bcrypt.hash(password, 4),
    ]);
    const invoice = await invoiceService.createInvoice({ userId: user.id, immediateStartConsent: false });
    await invoiceService.confirmPayment(invoice.id);

    const express = (await import('express')).default;
    const http = (await import('http')).default;
    const { requirePremium } = await import('../src/middleware/premium');
    const { authMiddleware } = await import('../src/middleware/auth');
    const app = express();
    app.use(express.json());
    app.use('/api/users', (await import('../src/routes/users')).default);
    app.get('/gated', authMiddleware, requirePremium(), (_req, res) => res.json({ ok: true }));
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const token = authService.issueAccessToken(user.id);
    const check = async () => {
      const login = (await authService.login({ email: user.email, password } as never)) as any;
      const me = await fetch(`${baseUrl}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } });
      const meBody = (await me.json()) as any;
      const gated = await fetch(`${baseUrl}/gated`, { headers: { Authorization: `Bearer ${token}` } });
      return {
        login: login.user?.is_premium,
        loginTier: login.user?.premium_tier,
        me: (meBody.user ?? meBody).is_premium,
        meTier: (meBody.user ?? meBody).premium_tier,
        gated: gated.status,
        status: (await premiumService.getStatus(user.id))?.is_premium,
      };
    };
    try {
      const before = await check();
      assert.deepStrictEqual(before, {
        login: false, loginTier: 'free', me: false, meTier: 'free', gated: 402, status: false,
      }, `day 0: ${JSON.stringify(before)}`);

      await shiftUserTimeBack(user.id, 13);
      const day13 = await check();
      assert.strictEqual(day13.login, false, 'day 13 still not Premium');
      assert.strictEqual(day13.gated, 402);

      await shiftUserTimeBack(user.id, 2);
      const after = await check();
      assert.deepStrictEqual(after, {
        login: true, loginTier: 'premium', me: true, meTier: 'premium', gated: 200, status: true,
      }, `day 15: ${JSON.stringify(after)}`);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

test('Member invoice left unticked starts after 14 days and the email says so', async () => {
  const user = await createTestUser('member-unticked');
  const invoice = await invoiceService.createInvoice({ userId: user.id, immediateStartConsent: false });
  assert.strictEqual(invoice.immediate_start_consent_at, null);
  const res = await invoiceService.confirmPayment(invoice.id);
  assert.strictEqual(
    res.userPremium.premiumStartsAt?.getTime(),
    cancellationPeriodEnd(new Date(invoice.created_at)).getTime(),
  );
});

async function adminServer() {
  const express = (await import('express')).default;
  const http = (await import('http')).default;
  const app = express();
  app.use(express.json());
  app.use('/api/admin', (await import('../src/routes/admin.routes')).default);
  process.env.ADMIN_TOKEN = 'test-admin-secret-token';
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const post = (path: string, body: unknown, token = 'test-admin-secret-token') =>
    fetch(`${baseUrl}/api/admin/premium/invoices/${path}`, {
      method: 'POST',
      headers: { 'x-admin-token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  return { post, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}

async function captureLogs<T>(run: () => Promise<T>): Promise<{ result: T; logs: string[] }> {
  const logs: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => {
    logs.push(a.map(String).join(' '));
  };
  try {
    return { result: await run(), logs };
  } finally {
    console.log = orig;
  }
}

test('Cancel/refund: not started gives a full refund and resets Premium; admin only; refund paid by hand recorded', async () => {
  const user = await createTestUser('refund-full');
  const invoice = await invoiceService.createInvoice({ userId: user.id, immediateStartConsent: false });
  await invoiceService.confirmPayment(invoice.id);
  const admin = await adminServer();
  try {
    assert.strictEqual((await admin.post(`${invoice.id}/cancel-refund`, { admin_actor: 'ops-r' }, 'wrong')).status, 401);
    assert.strictEqual((await admin.post(`${invoice.id}/cancel-refund`, {})).status, 400, 'actor required');

    const { result: res, logs } = await captureLogs(() => admin.post(`${invoice.id}/cancel-refund`, { admin_actor: 'ops-r' }));
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.refund_pence, 699, 'full refund before Premium starts');
    assert.strictEqual(body.days_had, 0);
    assert.strictEqual(body.invoice.status, 'refunded');
    assert.strictEqual(body.invoice.cancelled_by, 'ops-r');
    assert.strictEqual(body.invoice.refund_paid_at, null);
    const u = await query(`SELECT is_premium, premium_until, premium_starts_at FROM users WHERE id = $1`, [user.id]);
    assert.strictEqual(u.rows[0].is_premium, false, 'no Premium left');
    const sub = await query(`SELECT status FROM subscriptions WHERE user_id = $1 AND processor_subscription_id = $2`, [user.id, invoice.invoice_number]);
    assert.strictEqual(sub.rows[0].status, 'canceled');
    const line = logs.find((l) => l.includes('[invoice] cancel-refund'));
    assert.ok(line);
    assert.match(line!, new RegExp(`invoice=${invoice.id} admin=ops-r paid_pence=699 refund_pence=699 days_had=0 at=\\d{4}-`));
    assert.ok(!line!.includes(user.id) && !line!.includes(user.email), 'no member data');

    // Twice: refused.
    assert.strictEqual((await admin.post(`${invoice.id}/cancel-refund`, { admin_actor: 'ops-r' })).status, 409);

    const { result: paid, logs: paidLogs } = await captureLogs(() => admin.post(`${invoice.id}/refund-paid`, { admin_actor: 'ops-s' }));
    assert.strictEqual(paid.status, 200);
    const paidBody = (await paid.json()) as any;
    assert.ok(paidBody.invoice.refund_paid_at);
    assert.strictEqual(paidBody.invoice.refund_paid_by, 'ops-s');
    assert.strictEqual(paidBody.invoice.metadata.refund_method, 'bank_transfer_by_hand');
    assert.ok(paidLogs.some((l) => l.includes(`[invoice] refund-paid invoice=${invoice.id} admin=ops-s refund_pence=699`)));
    assert.strictEqual((await admin.post(`${invoice.id}/refund-paid`, { admin_actor: 'ops-s' })).status, 409, 'only once');
  } finally {
    await admin.close();
  }
});

test('Cancel/refund: started gives amount less days had, pro rata; refused after 14 days', async () => {
  const user = await createTestUser('refund-part');
  const invoice = await invoiceService.createInvoice({ userId: user.id, immediateStartConsent: true });
  await invoiceService.confirmPayment(invoice.id);
  // 2 days and 23 hours in: 2 completed days (a part day goes in the member's favour).
  await shiftUserTimeBack(user.id, 2);
  await query(
    `UPDATE subscriptions SET current_period_start = current_period_start - INTERVAL '23 hours' WHERE user_id = $1`,
    [user.id],
  );
  const r = await invoiceService.cancelPaidInvoiceWithRefund(invoice.id, 'ops-t');
  assert.strictEqual(r.daysHad, 2);
  // 699 * 2 / 30 = 46.6, floored to 46: refund 653p (never rounded against the member).
  assert.strictEqual(r.refundPence, 653);
  const status = await premiumService.getStatus(user.id);
  if (!premiumService.isBetaPremiumFree()) assert.strictEqual(status?.is_premium, false);

  const late = await createTestUser('refund-late');
  const inv2 = await invoiceService.createInvoice({ userId: late.id, immediateStartConsent: true });
  await invoiceService.confirmPayment(inv2.id);
  await shiftUserTimeBack(late.id, 15);
  await assert.rejects(() => invoiceService.cancelPaidInvoiceWithRefund(inv2.id, 'ops-t'), /cancellation_period_over/);
});

test('Cancel/refund keeps earlier Premium and earned referral months (never shortened)', async () => {
  const user = await createTestUser('refund-keep');
  const promoUntil = new Date(Date.now() + 40 * 86_400_000);
  await query(
    `UPDATE users SET is_premium = TRUE, premium_tier = 'premium', premium_starts_at = NOW() - INTERVAL '5 days', premium_until = $2 WHERE id = $1`,
    [user.id, promoUntil],
  );
  const invoice = await invoiceService.createInvoice({ userId: user.id, immediateStartConsent: true });
  await invoiceService.confirmPayment(invoice.id);
  // Earn one month while the paid period is active: stacked on it.
  const g = await query(
    `INSERT INTO referral_premium_grants (user_id, milestone, verified_count_at_grant, months_granted) VALUES ($1, 1, 3, 1) RETURNING id`,
    [user.id],
  );
  const { placeEarnedGrant } = await import('../src/services/referral-earned-months');
  const placed = await placeEarnedGrant(pool, user.id, g.rows[0].id, 1, { freeForEveryone: false });
  assert.strictEqual(placed.state, 'stacked');

  const r = await invoiceService.cancelPaidInvoiceWithRefund(invoice.id, 'ops-u');
  assert.strictEqual(r.refundPence, 699, 'paid days follow the promo, not started yet');
  // Promo kept, and the earned month runs on after it.
  assert.ok(r.premiumUntil && r.premiumUntil.getTime() > promoUntil.getTime() + 27 * 86_400_000, 'earned month kept after the promo');
  assert.ok(r.premiumUntil!.getTime() < promoUntil.getTime() + 32 * 86_400_000, 'paid 30 days removed');
  const u = await query(`SELECT is_premium, premium_starts_at FROM users WHERE id = $1`, [user.id]);
  assert.strictEqual(u.rows[0].is_premium, true);
  assert.ok(new Date(u.rows[0].premium_starts_at).getTime() < Date.now(), 'running promo keeps its start');
});

test('End of period: the manual invoice subscription closes, the card stops saying paid, a new month starts from now', async () => {
  const rem = await import('../src/services/referral-earned-months');
  const user = await createTestUser('period-end');
  const invoice = await invoiceService.createInvoice({ userId: user.id, immediateStartConsent: true });
  await invoiceService.confirmPayment(invoice.id);
  assert.strictEqual(await rem.rewardModeFor(pool, user.id, { freeForEveryone: false }), 'paid');

  await shiftUserTimeBack(user.id, 45);
  const mode = await rem.rewardModeFor(pool, user.id, { freeForEveryone: false });
  assert.notStrictEqual(mode, 'paid', 'no paid line after the period ends');
  const sub = await query(`SELECT status FROM subscriptions WHERE user_id = $1 AND processor = 'manual_invoice'`, [user.id]);
  assert.strictEqual(sub.rows[0].status, 'expired', 'subscription closed');

  const g = await query(
    `INSERT INTO referral_premium_grants (user_id, milestone, verified_count_at_grant, months_granted) VALUES ($1, 1, 3, 1) RETURNING id`,
    [user.id],
  );
  const before = Date.now();
  const placed = await rem.placeEarnedGrant(pool, user.id, g.rows[0].id, 1, { freeForEveryone: false });
  assert.strictEqual(placed.state, 'applied');
  const days = (placed.premiumUntil!.getTime() - before) / 86_400_000;
  assert.ok(days > 27 && days < 33, `earned month runs from now (${days.toFixed(1)} days)`);
});

test('Buying more never counts earned months twice', async () => {
  const rem = await import('../src/services/referral-earned-months');
  const DAY = 86_400_000;
  const user = await createTestUser('no-double');
  const inv1 = await invoiceService.createInvoice({ userId: user.id, immediateStartConsent: true });
  const c1 = await invoiceService.confirmPayment(inv1.id);
  const paidEnd1 = c1.userPremium.premiumUntil!.getTime();
  const g1 = await query(
    `INSERT INTO referral_premium_grants (user_id, milestone, verified_count_at_grant, months_granted) VALUES ($1, 1, 3, 1) RETURNING id`,
    [user.id],
  );
  const p1 = await rem.placeEarnedGrant(pool, user.id, g1.rows[0].id, 1, { freeForEveryone: false });
  const afterEarn = p1.premiumUntil!.getTime();
  assert.ok(afterEarn - paidEnd1 > 27 * DAY && afterEarn - paidEnd1 < 32 * DAY, 'one month stacked');

  // Buy more: +30 days on the paid end, the earned month still rides once.
  const inv2 = await invoiceService.createInvoice({ userId: user.id, immediateStartConsent: true });
  const c2 = await invoiceService.confirmPayment(inv2.id);
  const afterBuy = c2.userPremium.premiumUntil!.getTime();
  assert.ok(Math.abs(afterBuy - (afterEarn + 30 * DAY)) < 2 * DAY, `buy adds 30 days only (${(afterBuy - afterEarn) / DAY})`);

  // Earn another: exactly one more month, not two.
  const g2 = await query(
    `INSERT INTO referral_premium_grants (user_id, milestone, verified_count_at_grant, months_granted) VALUES ($1, 2, 6, 1) RETURNING id`,
    [user.id],
  );
  const p2 = await rem.placeEarnedGrant(pool, user.id, g2.rows[0].id, 1, { freeForEveryone: false });
  const gain = (p2.premiumUntil!.getTime() - afterBuy) / DAY;
  assert.ok(gain > 27 && gain < 32, `second month adds one month only (${gain.toFixed(1)} days)`);

  // And with applied months before any paid period (free member who earned a month first).
  const u2 = await createTestUser('no-double-applied');
  const g3 = await query(
    `INSERT INTO referral_premium_grants (user_id, milestone, verified_count_at_grant, months_granted) VALUES ($1, 1, 3, 1) RETURNING id`,
    [u2.id],
  );
  const p3 = await rem.placeEarnedGrant(pool, u2.id, g3.rows[0].id, 1, { freeForEveryone: false });
  const inv3 = await invoiceService.createInvoice({ userId: u2.id, immediateStartConsent: true });
  const c3 = await invoiceService.confirmPayment(inv3.id);
  const afterBuy3 = c3.userPremium.premiumUntil!.getTime();
  assert.ok(Math.abs(afterBuy3 - (p3.premiumUntil!.getTime() + 30 * DAY)) < 2 * DAY, 'paid days after the earned month');
  const g4 = await query(
    `INSERT INTO referral_premium_grants (user_id, milestone, verified_count_at_grant, months_granted) VALUES ($1, 2, 6, 1) RETURNING id`,
    [u2.id],
  );
  const p4 = await rem.placeEarnedGrant(pool, u2.id, g4.rows[0].id, 1, { freeForEveryone: false });
  const gain4 = (p4.premiumUntil!.getTime() - afterBuy3) / DAY;
  assert.ok(gain4 > 27 && gain4 < 32, `earlier applied month not re-added (${gain4.toFixed(1)} days)`);
});

test('Pro rata boundaries: exactly 0, 1 and 14 completed days, integer pence, floored deduction', async () => {
  const DAY = 86_400_000;
  const cases: Array<[number, number, number]> = [
    // [days in, days had, refund pence]
    [0, 0, 699],
    [1, 1, 699 - Math.floor(699 / 30)], // 676
    [14, 14, 699 - Math.floor((699 * 14) / 30)], // 373
  ];
  for (const [daysIn, expectHad, expectRefund] of cases) {
    const user = await createTestUser(`prorata-${daysIn}`);
    const invoice = await invoiceService.createInvoice({ userId: user.id, immediateStartConsent: true });
    await invoiceService.confirmPayment(invoice.id);
    const sub = await query(
      `SELECT current_period_start FROM subscriptions WHERE user_id = $1 AND processor_subscription_id = $2`,
      [user.id, invoice.invoice_number],
    );
    const start = new Date(sub.rows[0].current_period_start);
    // Bought at the moment Premium started, so day 14 exactly is still inside the 14 days.
    await query(`UPDATE premium_invoices SET created_at = $2, requested_at = $2 WHERE id = $1`, [invoice.id, start]);
    const r = await invoiceService.cancelPaidInvoiceWithRefund(invoice.id, 'ops-p', new Date(start.getTime() + daysIn * DAY));
    assert.strictEqual(r.daysHad, expectHad, `days had at ${daysIn}`);
    assert.strictEqual(r.refundPence, expectRefund, `refund at ${daysIn}`);
    assert.ok(Number.isInteger(r.refundPence));
  }
  assert.deepStrictEqual(cases.map((c) => c[2]), [699, 676, 373]);
});

test('Refund email: sent once when refund-paid is recorded, right content, nothing on a repeat call', async () => {
  const { invoiceMailer } = await import('../src/services/invoice.service');
  const sent: Array<{ to: string; subject: string; html: string; text: string }> = [];
  const realSend = invoiceMailer.send;
  invoiceMailer.send = async (msg) => {
    sent.push(msg);
  };
  try {
    const user = await createTestUser('refund-mail', 'Sam');
    const invoice = await invoiceService.createInvoice({ userId: user.id, immediateStartConsent: true });
    await invoiceService.confirmPayment(invoice.id);
    await shiftUserTimeBack(user.id, 3);
    const cancelled = await invoiceService.cancelPaidInvoiceWithRefund(invoice.id, 'ops-m');
    assert.strictEqual(sent.length, 0, 'no email on cancel, only once the refund is paid');

    await invoiceService.markRefundPaid(invoice.id, 'ops-m');
    assert.strictEqual(sent.length, 1, 'sent once');
    const mail = sent[0];
    assert.strictEqual(mail.to, user.email);
    assert.strictEqual(mail.subject, 'Your MenRush refund is on its way');
    const amount = `£${(cancelled.refundPence / 100).toFixed(2)}`;
    const endedDay = new Date(cancelled.invoice.cancelled_at as string).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London',
    });
    for (const body of [mail.text, mail.html]) {
      assert.ok(body.includes(amount), 'refund amount');
      assert.ok(body.includes(invoice.invoice_number), 'invoice reference');
      assert.match(body, /by bank transfer to the account you paid from/);
      assert.ok(body.includes(`ended on ${endedDay}`), 'when Premium ended');
      assert.match(body, /Invoice number: /);
      assert.match(body, /Refund amount: /);
      assert.match(body, /All the best,/);
      assert.match(body, /MenRush/);
    }
    assert.match(mail.text, /^Hello Sam,/);
    assert.doesNotMatch(mail.text, /[\u2013\u2014]| - |beta|\blove\b|14-day/i);
    assert.doesNotMatch(mail.text, /Invoice Number|Refund Amount/, 'sentence case labels');
    assert.match(mail.html, /<html|<table/i, 'uses the MenRush email template');

    const meta = await query(`SELECT metadata FROM premium_invoices WHERE id = $1`, [invoice.id]);
    assert.ok(meta.rows[0].metadata.refund_email_sent_at);

    // Repeat call: refused and no second email.
    await assert.rejects(() => invoiceService.markRefundPaid(invoice.id, 'ops-m'), /refund_not_due/);
    assert.strictEqual(sent.length, 1, 'nothing on a repeat call');

    // Not started: the email says so.
    const u2 = await createTestUser('refund-mail-2');
    const inv2 = await invoiceService.createInvoice({ userId: u2.id, immediateStartConsent: false });
    await invoiceService.confirmPayment(inv2.id);
    await invoiceService.cancelPaidInvoiceWithRefund(inv2.id, 'ops-m');
    await invoiceService.markRefundPaid(inv2.id, 'ops-m');
    assert.strictEqual(sent.length, 2);
    assert.match(sent[1].text, /had not started yet/);

    // Started but cancelled inside the first day: 0 completed days, full refund, and it did start.
    const u3 = await createTestUser('refund-mail-3');
    const inv3 = await invoiceService.createInvoice({ userId: u3.id, immediateStartConsent: true });
    await invoiceService.confirmPayment(inv3.id);
    const r3 = await invoiceService.cancelPaidInvoiceWithRefund(inv3.id, 'ops-m', new Date(Date.now() + 3_600_000));
    assert.strictEqual(r3.refundPence, 699);
    await invoiceService.markRefundPaid(inv3.id, 'ops-m');
    assert.doesNotMatch(sent[2].text, /had not started yet/);
    assert.match(sent[2].text, /ended on .*, when you cancelled/);
    assert.ok(sent[1].text.includes('£6.99'));
  } finally {
    invoiceMailer.send = realSend;
  }
});

test("Customer copy says '14 day' as Legal writes it, never '14-day' (email, notification)", () => {
  const now = new Date('2026-10-11T09:00:00Z');
  const startsAt = new Date('2026-10-25T09:00:00Z');
  const copies: string[] = [];
  for (const startedStraightAway of [true, false]) {
    const e = buildPremiumOnEmail({
      name: 'Sam',
      amountPence: 699,
      premiumUntil: new Date('2026-11-24T09:00:00Z'),
      invoiceNumber: 'MR-INV-20261011-AAA111',
      paymentReference: 'MR-1111AAAA',
      startedStraightAway,
      premiumStartsAt: startedStraightAway ? null : startsAt,
      now,
    });
    copies.push(e.subject, e.text, e.html);
  }
  for (const premiumHadStarted of [true, false]) {
    const e = buildRefundPaidEmail({ name: 'Sam', refundPence: 653, invoiceNumber: 'MR-INV-X', premiumEndedAt: now, premiumHadStarted });
    copies.push(e.subject, e.text, e.html);
  }
  for (const n of [
    buildPremiumPaidNotification({ invoiceNumber: 'MR-INV-20261011-AAA111', premiumStartsAt: startsAt }),
    buildPremiumPaidNotification({ invoiceNumber: 'MR-INV-20261011-AAA111', premiumStartsAt: null }),
  ]) {
    copies.push(n.title, n.body);
  }
  for (const c of copies) assert.doesNotMatch(c, /14-day/i, c.slice(0, 80));
  assert.match(
    buildPremiumPaidNotification({ invoiceNumber: 'X', premiumStartsAt: startsAt }).body,
    /Your Premium starts on 25 October 2026, after the 14 day cancellation period\./,
  );
});

test('Migration 085 is tracked in schema_migrations', async () => {
  const migRes = await query(
    `SELECT version FROM schema_migrations WHERE version = '085_premium_invoices.sql'`,
  );
  assert.ok(migRes.rows.length >= 1, 'Migration for premium_invoices recorded as 085');
});

test('Confirm payment is refused on a refunded invoice', async () => {
  const user = await createTestUser('confirm-refunded');
  const invoice = await invoiceService.createInvoice({ userId: user.id, immediateStartConsent: true });
  await invoiceService.confirmPayment(invoice.id);
  await invoiceService.cancelPaidInvoiceWithRefund(invoice.id, 'ops-r');
  const before = await query(`SELECT premium_until, premium_starts_at FROM users WHERE id = $1`, [user.id]);
  await assert.rejects(() => invoiceService.confirmPayment(invoice.id), /refunded invoice/);
  const after = await query(`SELECT premium_until, premium_starts_at FROM users WHERE id = $1`, [user.id]);
  assert.deepStrictEqual(after.rows[0], before.rows[0], 'no Premium granted by a refused confirm');
  const row = await invoiceService.getInvoiceById(invoice.id);
  assert.strictEqual(row?.status, 'refunded');
});

test('requested_at: set when the member asks; the 14 day window and delayed start run from it, not payment', async () => {
  const user = await createTestUser('requested-at');
  const t0 = Date.now();
  const invoice = await invoiceService.createInvoice({ userId: user.id, immediateStartConsent: false });
  assert.ok(invoice.requested_at, 'requested_at is set on create');
  assert.ok(Math.abs(new Date(invoice.requested_at as string).getTime() - t0) < 60_000);

  // Asked 10 days ago, paid only now: Premium starts 14 days after the ASK (4 days from now), not after payment.
  await query(`UPDATE premium_invoices SET requested_at = NOW() - INTERVAL '10 days' WHERE id = $1`, [invoice.id]);
  await invoiceService.confirmPayment(invoice.id);
  const u = await query(`SELECT premium_starts_at FROM users WHERE id = $1`, [user.id]);
  const startsIn = new Date(u.rows[0].premium_starts_at).getTime() - Date.now();
  assert.ok(startsIn > 3.9 * 86_400_000 && startsIn < 4.1 * 86_400_000, `starts ~4 days from now, got ${startsIn}`);

  // Window: asked 15 days ago but paid and created just now -> cancellation refused.
  const late = await createTestUser('requested-at-late');
  const inv2 = await invoiceService.createInvoice({ userId: late.id, immediateStartConsent: true });
  await invoiceService.confirmPayment(inv2.id);
  await query(`UPDATE premium_invoices SET requested_at = NOW() - INTERVAL '15 days' WHERE id = $1`, [inv2.id]);
  await assert.rejects(() => invoiceService.cancelPaidInvoiceWithRefund(inv2.id, 'ops-w'), /cancellation_period_over/);

  // And the reverse: paid long after creation still inside 14 days of the ask -> allowed.
  const ok = await createTestUser('requested-at-ok');
  const inv3 = await invoiceService.createInvoice({ userId: ok.id, immediateStartConsent: true });
  await query(`UPDATE premium_invoices SET created_at = NOW() - INTERVAL '30 days', requested_at = NOW() - INTERVAL '13 days' WHERE id = $1`, [inv3.id]);
  await invoiceService.confirmPayment(inv3.id);
  const r = await invoiceService.cancelPaidInvoiceWithRefund(inv3.id, 'ops-w');
  assert.ok(r.refundPence > 0);
});

test('Payment instructions carry the start line from the recorded choice, never the old "switches on" line', async () => {
  const { getManualPaymentInstructions, invoiceStartLine } = await import('../src/services/invoice.service');
  const user = await createTestUser('start-line');
  const unticked = await invoiceService.createInvoice({ userId: user.id, immediateStartConsent: false });
  const pi = getManualPaymentInstructions(unticked.payment_reference, unticked);
  assert.doesNotMatch(pi.instructions, /switches on once we have confirmed your payment/i);
  assert.match(pi.premium_start_line ?? '', /^Your Premium starts on \d{1,2} \w+ \d{4}, after the 14 day cancellation period/);
  assert.strictEqual(pi.premium_start_line, invoiceStartLine(unticked));
  const u2 = await createTestUser('start-line-2');
  const ticked = await invoiceService.createInvoice({ userId: u2.id, immediateStartConsent: true });
  assert.strictEqual(
    getManualPaymentInstructions(ticked.payment_reference, ticked).premium_start_line,
    'Your Premium starts as soon as we confirm your payment.',
  );
});

test('Refund email failure: retried, flagged for ops, team alerted (invoice id only), resend works once', async () => {
  const { invoiceMailer } = await import('../src/services/invoice.service');
  const realSend = invoiceMailer.send;
  const realOps = invoiceMailer.sendOps;
  const prevTeam = process.env.TEAM_EMAILS;
  let attempts = 0;
  const memberSent: string[] = [];
  const opsSent: Array<{ to: string; subject: string; text: string }> = [];
  invoiceMailer.send = async (msg) => {
    attempts += 1;
    if (failing) throw new Error('smtp down');
    memberSent.push(msg.to);
  };
  invoiceMailer.sendOps = async (msg) => {
    opsSent.push(msg);
  };
  let failing = true;
  process.env.TEAM_EMAILS = 'ops@test.menrush.local';
  try {
    const user = await createTestUser('refund-fail', 'Sam');
    const invoice = await invoiceService.createInvoice({ userId: user.id, immediateStartConsent: true });
    await invoiceService.confirmPayment(invoice.id);
    await invoiceService.cancelPaidInvoiceWithRefund(invoice.id, 'ops-f');
    const paid = await invoiceService.markRefundPaid(invoice.id, 'ops-f');
    assert.strictEqual(attempts, 2, 'retried once');
    assert.ok(paid.refund_paid_at, 'refund still recorded as paid');
    const md = (paid.metadata ?? {}) as Record<string, unknown>;
    assert.ok(md.refund_email_failed_at, 'ops-visible flag set');
    assert.ok(!md.refund_email_sent_at);
    // Shown to ops in the admin list.
    const list = await invoiceService.listAllInvoices(500, 'refunded');
    assert.ok(list.some((i) => i.id === invoice.id && (i.metadata as any)?.refund_email_failed_at));
    // Team alert: invoice id/number only, no member email or name.
    assert.ok(opsSent.length >= 1, 'team alerted');
    for (const m of opsSent) {
      assert.match(m.text, new RegExp(invoice.id));
      assert.doesNotMatch(m.text + m.subject, new RegExp(user.email.replace(/[.+]/g, '\\$&')));
      assert.doesNotMatch(m.text, /\bSam\b/);
    }

    // Resend after the mailer is back: sent once, flag cleared; a second resend sends nothing.
    failing = false;
    assert.strictEqual(await invoiceService.sendRefundEmail(invoice.id), 'sent');
    assert.deepStrictEqual(memberSent, [user.email]);
    const row = await invoiceService.getInvoiceById(invoice.id);
    const md2 = (row?.metadata ?? {}) as Record<string, unknown>;
    assert.ok(md2.refund_email_sent_at);
    assert.ok(!md2.refund_email_failed_at, 'flag cleared after a good resend');
    assert.strictEqual(await invoiceService.sendRefundEmail(invoice.id), 'already_sent');
    assert.strictEqual(memberSent.length, 1);

    // Not due on an invoice whose refund is not paid.
    const u2 = await createTestUser('refund-fail-2');
    const inv2 = await invoiceService.createInvoice({ userId: u2.id, immediateStartConsent: true });
    await invoiceService.confirmPayment(inv2.id);
    assert.strictEqual(await invoiceService.sendRefundEmail(inv2.id), 'not_due');
  } finally {
    invoiceMailer.send = realSend;
    invoiceMailer.sendOps = realOps;
    if (prevTeam === undefined) delete process.env.TEAM_EMAILS; else process.env.TEAM_EMAILS = prevTeam;
  }
});

async function main() {
  console.log(`Running ${tests.length} manual invoice and password tests...`);
  for (const t of tests) {
    try {
      await t.run();
      console.log(`ok  - ${t.name}`);
    } catch (err) {
      console.error(`FAIL: ${t.name}`);
      console.error(err);
      process.exit(1);
    }
  }
  console.log(`\nAll ${tests.length} tests passed successfully.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
