/**
 * End-to-end HTTP Test for Venue Calendar MVP — Tropics Portsmouth Path
 *
 * Runs Express app and tests HTTP endpoints over HTTP.
 */
import assert from 'assert';
import http from 'http';
import express from 'express';
import { randomUUID } from 'crypto';
import hotSpotsRoutes from '../src/routes/hot-spots';
import eventRoutes from '../src/routes/events';
import adminRoutes from '../src/routes/admin.routes';
import pool, { query } from '../src/db';
import { authService } from '../src/services/auth.service';

const LEGAL_ATTESTATION =
  'I attest that I am an authorized owner, manager, or representative of this venue. I understand that submitting a false or fraudulent claim will result in immediate suspension or permanent freeze/ban of my MenRush account and forfeiture of venue rights.';

async function run() {
  console.log('--- Starting Venue Calendar HTTP Endpoint Tests ---');

  process.env.ADMIN_TOKEN = 'test_ops_admin_token_123';

  const app = express();
  app.use(express.json());
  app.use('/api/hot-spots', hotSpotsRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/admin', adminRoutes);

  // Start HTTP server on ephemeral port
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Server listening on port ${port}`);

  try {
    // 1. Locate Tropics Day Spa
    const tropicsRes = await query(
      `SELECT hs.id, hs.name, hs.city, hs.latitude, hs.longitude
         FROM hot_spots hs
        WHERE hs.name ILIKE '%Tropics%' AND hs.city = 'Portsmouth'`,
    );
    assert.ok(tropicsRes.rows.length > 0, 'Tropics Day Spa must exist');
    const tropics = tropicsRes.rows[0];

    // Reset clean state
    await query(`DELETE FROM rooms WHERE spot_id = $1`, [tropics.id]);
    await query(`DELETE FROM venue_claims WHERE spot_id = $1`, [tropics.id]);
    await query(
      `UPDATE hot_spots
          SET claim_status = 'unclaimed',
              claimed_by_user_id = NULL,
              active_claim_id = NULL,
              claimed_at = NULL,
              is_calendar_managed = FALSE
        WHERE id = $1`,
      [tropics.id],
    );

    // Create user and token
    const userId = randomUUID();
    const email = `http-claimant-${userId.slice(0, 6)}@example.com`;
    await query(
      `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status)
       VALUES ($1, $2, 'hash', 'Tropics Manager', 32, TRUE, 'verified')`,
      [userId, email],
    );
    const token = authService.issueAccessToken(userId);
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // 2. Submit Claim: POST /api/hot-spots/:id/claim
    const claimRes = await fetch(`${baseUrl}/api/hot-spots/${tropics.id}/claim`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        venue_role: 'General Manager',
        contact_name: 'Alex Turner',
        contact_email: 'alex@tropics-portsmouth.co.uk',
        contact_phone: '+44 23 9282 0000',
        website_or_social_proof: 'https://tropicsdayspa.co.uk',
        attestation_agreed: true,
        attestation_text: LEGAL_ATTESTATION,
      }),
    });
    assert.strictEqual(claimRes.status, 201, 'POST /claim should return 201');
    const claimData: any = await claimRes.json();
    assert.strictEqual(claimData.ok, true);
    assert.strictEqual(claimData.claim.status, 'pending');
    console.log('✓ POST /api/hot-spots/:id/claim returned 201 with pending status');

    // 3. Check Claim Status: GET /api/hot-spots/:id/claim
    const statusRes = await fetch(`${baseUrl}/api/hot-spots/${tropics.id}/claim`, {
      headers: authHeaders,
    });
    assert.strictEqual(statusRes.status, 200);
    const statusData: any = await statusRes.json();
    assert.strictEqual(statusData.claim_status, 'pending');
    assert.strictEqual(statusData.my_claim.status, 'pending');
    console.log('✓ GET /api/hot-spots/:id/claim returned 200 with pending claim');

    // 4. Before ops approval, event creation must be rejected with 403
    const blockedEventRes = await fetch(`${baseUrl}/api/hot-spots/${tropics.id}/events`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Unauthorized Session',
        starts_at: new Date(Date.now() + 3600000 * 24).toISOString(),
      }),
    });
    assert.strictEqual(blockedEventRes.status, 403, 'Should be 403 before ops approval');
    console.log('✓ POST /api/hot-spots/:id/events blocked with 403 before ops approval');

    // 5. Ops Approval: POST /api/admin/venue-claims/:id/approve
    const approveRes = await fetch(`${baseUrl}/api/admin/venue-claims/${claimData.claim.id}/approve`, {
      method: 'POST',
      headers: {
        'x-admin-token': 'test_ops_admin_token_123',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notes: 'Verified via Tropics telephone & website' }),
    });
    assert.strictEqual(approveRes.status, 200);
    const approveData: any = await approveRes.json();
    assert.strictEqual(approveData.ok, true);
    assert.strictEqual(approveData.claim.status, 'approved');
    console.log('✓ POST /api/admin/venue-claims/:id/approve returned 200');

    // 6. Create Event: POST /api/hot-spots/:id/events
    const tomorrow = new Date(Date.now() + 3600000 * 24).toISOString();
    const createEventRes = await fetch(`${baseUrl}/api/hot-spots/${tropics.id}/events`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Tropics Sunday Bear Session',
        description: 'Afternoon steam & sauna session in Portsmouth',
        starts_at: tomorrow,
        ticket_url: 'https://tropicsdayspa.co.uk/tickets',
      }),
    });
    assert.strictEqual(createEventRes.status, 201);
    const eventData: any = await createEventRes.json();
    assert.strictEqual(eventData.ok, true);
    assert.strictEqual(eventData.event.name, 'Tropics Sunday Bear Session');
    assert.strictEqual(eventData.event.managed_label, 'Calendar managed by venue');
    console.log('✓ POST /api/hot-spots/:id/events created event with "Calendar managed by venue"');

    // 7. Verify Public Events: GET /api/events/nearby
    const nearbyRes = await fetch(
      `${baseUrl}/api/events/nearby?lat=${tropics.latitude}&lng=${tropics.longitude}&radius=25`,
      { headers: authHeaders },
    );
    assert.strictEqual(nearbyRes.status, 200);
    const nearbyEvents: any = await nearbyRes.json();
    const tropicsEvent = nearbyEvents.find((e: any) => e.id === eventData.event.id);
    assert.ok(tropicsEvent, 'Event must appear in public events discovery');
    assert.strictEqual(tropicsEvent.is_venue_managed, true);
    assert.strictEqual(tropicsEvent.managed_label, 'Calendar managed by venue');
    console.log('✓ GET /api/events/nearby returned venue-managed event with quiet face copy');

    // 8. Update Event: PATCH /api/hot-spots/:id/events/:eventId
    const updateRes = await fetch(`${baseUrl}/api/hot-spots/${tropics.id}/events/${eventData.event.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Tropics Sunday Mega Session',
      }),
    });
    assert.strictEqual(updateRes.status, 200);
    const updateData: any = await updateRes.json();
    assert.strictEqual(updateData.event.name, 'Tropics Sunday Mega Session');
    console.log('✓ PATCH /api/hot-spots/:id/events/:eventId updated successfully');

    // 9. Cancel Event: POST /api/hot-spots/:id/events/:eventId/cancel
    const cancelRes = await fetch(
      `${baseUrl}/api/hot-spots/${tropics.id}/events/${eventData.event.id}/cancel`,
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ cancellation_reason: 'Plunge pool maintenance' }),
      },
    );
    assert.strictEqual(cancelRes.status, 200);
    const cancelData: any = await cancelRes.json();
    assert.strictEqual(cancelData.event.status, 'cancelled');
    console.log('✓ POST /api/hot-spots/:id/events/:eventId/cancel cancelled event');

    // Clean up
    await query(`DELETE FROM rooms WHERE spot_id = $1`, [tropics.id]);
    await query(`DELETE FROM venue_claims WHERE spot_id = $1`, [tropics.id]);
    await query(
      `UPDATE hot_spots
          SET claim_status = 'unclaimed',
              claimed_by_user_id = NULL,
              active_claim_id = NULL,
              claimed_at = NULL,
              is_calendar_managed = FALSE
        WHERE id = $1`,
      [tropics.id],
    );
    await query(`DELETE FROM users WHERE id = $1`, [userId]);

    console.log('--- All Venue Calendar HTTP Tests Passed Successfully ---');
  } finally {
    server.close();
  }
}

run()
  .then(() => {
    pool.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error('HTTP test failed:', err);
    pool.end();
    process.exit(1);
  });
