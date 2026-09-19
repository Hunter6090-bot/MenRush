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
 * 6. Set / Change Password flow during invoice journey:
 *    - Account with password requires correct current password to change.
 *    - Account without password can set password without current password.
 *    - New password works for subsequent login.
 */
import assert from 'assert';
import { randomUUID } from 'crypto';
import pool, { query } from '../src/db';
import { authService } from '../src/services/auth.service';
import { invoiceService, getManualPaymentInstructions } from '../src/services/invoice.service';
import { premiumService } from '../src/services/premium.service';

type Test = { name: string; run: () => void | Promise<void> };
const tests: Test[] = [];

function test(name: string, run: Test['run']) {
  tests.push({ name, run });
}

async function createTestUser(emailSuffix: string, name = 'TestUser', isAlways = false) {
  const id = randomUUID();
  const email = `invoice-test-${emailSuffix}-${randomUUID().slice(0, 6)}@test.menrush.local`;
  const userName = isAlways ? 'BOA90' : name;
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
  const inv1 = await invoiceService.createInvoice({ userId: user.id, planDays: 30 });
  assert.strictEqual(inv1.status, 'unpaid');

  const inv2 = await invoiceService.createInvoice({ userId: user.id, planDays: 60, amountPence: 1299 });
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
  const user = await createTestUser('always-owner', 'BOA90', true);
  await query(
    `UPDATE users SET is_premium = TRUE, premium_tier = 'premium', premium_until = NULL WHERE id = $1`,
    [user.id],
  );

  const invoice = await invoiceService.createInvoice({ userId: user.id, planDays: 30 });
  const confirmRes = await invoiceService.confirmPayment(invoice.id);
  assert.strictEqual(confirmRes.userPremium.premiumUntil, null, 'Lifetime open-ended null until is preserved');

  const userRow = await query(`SELECT premium_until, is_premium FROM users WHERE id = $1`, [user.id]);
  assert.strictEqual(userRow.rows[0].premium_until, null);
  assert.strictEqual(userRow.rows[0].is_premium, true);
});

test('Cancelled invoices cannot be paid', async () => {
  const user = await createTestUser('cancel-test');
  const invoice = await invoiceService.createInvoice({ userId: user.id, planDays: 30 });

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
      body: JSON.stringify({ plan_tier: 'premium', plan_days: 30, amount_pence: 699 }),
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
    assert.strictEqual(resSetPwFail.status, 401);

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

test('Migration 067 is tracked in schema_migrations', async () => {
  const migRes = await query(
    `SELECT version FROM schema_migrations WHERE version = '067_premium_invoices.sql'`,
  );
  assert.ok(migRes.rows.length >= 1, 'Migration for premium_invoices recorded as 067');
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
