/**
 * Integration Test: Venue Calendar MVP — Tropics Portsmouth Path
 *
 * Verifies:
 * 1. Tropics Day Spa exists as an existing commercial Hot Spot pin
 * 2. Non-commercial or fake venues cannot be claimed (no invent-a-venue)
 * 3. Attestation is mandatory (fails without attestation agreement)
 * 4. Claim is submitted in pending state (Ops approval gate)
 * 5. Claimant cannot publish or manage calendar while pending
 * 6. Ops approval grants calendar management rights
 * 7. Venue Calendar CRUD (create, update, cancel schedule events)
 * 8. Events appear on public events discovery with quiet face copy:
 *    "Calendar managed by venue" / "Venue claimed"
 *    NEVER "Verified Business", "Partner", "Sponsored", "Endorsed"
 * 9. Dispute / freeze path suspends calendar rights
 * 10. False-claim ban path restricts user account
 */

import assert from 'assert';
import { randomUUID } from 'crypto';
import pool, { query } from '../src/db';
import { venueClaimService } from '../src/services/venue-claim.service';
import { venueCalendarService } from '../src/services/venue-calendar.service';
import { eventService } from '../src/services/event.service';
import { hotSpotsService } from '../src/services/hot-spots.service';

const LEGAL_ATTESTATION =
  'I attest that I am an authorized owner, manager, or representative of this venue. I understand that submitting a false or fraudulent claim will result in immediate suspension or permanent freeze/ban of my MenRush account and forfeiture of venue rights.';

async function run() {
  console.log('--- Starting Venue Calendar Tropics Integration Test ---');

  // 1. Locate Tropics Day Spa in Portsmouth
  const tropicsRes = await query(
    `SELECT hs.id, hs.name, hs.city, hs.latitude, hs.longitude, hs.external_id, c.is_commercial
       FROM hot_spots hs
       JOIN hot_spot_categories c ON c.id = hs.category_id
      WHERE hs.external_id = 'green-2026-09:tropics-portsmouth'
         OR (hs.name ILIKE '%Tropics%' AND hs.city = 'Portsmouth')`,
  );
  assert.ok(tropicsRes.rows.length > 0, 'Tropics Day Spa must exist in hot_spots');
  const tropics = tropicsRes.rows[0];
  assert.strictEqual(tropics.is_commercial, true, 'Tropics must be a commercial venue pin');
  console.log(`✓ Located commercial pin: ${tropics.name} in ${tropics.city} (id: ${tropics.id})`);

  // Reset any prior test claims on Tropics for a clean run
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

  // Create test user (claimant)
  const claimantId = randomUUID();
  const claimantEmail = `tropics-manager-${claimantId.slice(0, 8)}@example.com`;
  await query(
    `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status)
     VALUES ($1, $2, 'test_hash', 'Tropics Manager', 35, TRUE, 'verified')`,
    [claimantId, claimantEmail],
  );

  // 2. Reject claim on non-commercial spot (e.g. outdoor spot)
  const outdoorSpotRes = await query(
    `SELECT hs.id FROM hot_spots hs
       JOIN hot_spot_categories c ON c.id = hs.category_id
      WHERE c.is_commercial = FALSE AND hs.is_active = TRUE LIMIT 1`,
  );
  if (outdoorSpotRes.rows.length > 0) {
    const outdoorId = outdoorSpotRes.rows[0].id;
    await assert.rejects(
      venueClaimService.submitClaim(claimantId, outdoorId, {
        venue_role: 'manager',
        contact_name: 'Tropics Manager',
        contact_email: claimantEmail,
        attestation_agreed: true,
        attestation_text: LEGAL_ATTESTATION,
      }),
      /Only existing commercial venue pins can be claimed/i,
      'Must reject claims on non-commercial spots',
    );
    console.log('✓ Rejected claim on non-commercial spot');
  }

  // 3. Reject fake / non-existent venue pin
  await assert.rejects(
    venueClaimService.submitClaim(claimantId, randomUUID(), {
      venue_role: 'manager',
      contact_name: 'Tropics Manager',
      contact_email: claimantEmail,
      attestation_agreed: true,
      attestation_text: LEGAL_ATTESTATION,
    }),
    /Venue not found/i,
    'Must reject claims on non-existent venues',
  );
  console.log('✓ Rejected claim on non-existent venue (no invent-a-venue)');

  // 4. Submit claim for Tropics Day Spa
  const claim = await venueClaimService.submitClaim(claimantId, tropics.id, {
    venue_role: 'General Manager',
    contact_name: 'Alex Turner',
    contact_email: 'management@tropics-portsmouth.co.uk',
    contact_phone: '+44 23 9282 0000',
    website_or_social_proof: 'https://tropicsdayspa.co.uk',
    attestation_agreed: true,
    attestation_text: LEGAL_ATTESTATION,
    domain_email: 'alex@tropicsdayspa.co.uk',
  });
  assert.strictEqual(claim.status, 'pending', 'Submitted claim must start in pending status');
  assert.strictEqual(claim.spot_id, tropics.id);
  assert.strictEqual(claim.attestation_agreed, true);
  assert.strictEqual(claim.attestation_text, LEGAL_ATTESTATION);
  console.log('✓ Claim submitted in pending state with legal attestation');

  // Verify duplicate pending claim is rejected
  await assert.rejects(
    venueClaimService.submitClaim(claimantId, tropics.id, {
      venue_role: 'Owner',
      contact_name: 'Alex Turner',
      contact_email: 'owner@tropicsdayspa.co.uk',
      attestation_agreed: true,
      attestation_text: LEGAL_ATTESTATION,
    }),
    /already have a pending claim/i,
    'Duplicate pending claim must be rejected',
  );
  console.log('✓ Duplicate pending claim rejected');

  // 5. Verify claimant cannot publish calendar events before ops approval
  await assert.rejects(
    venueCalendarService.createEvent(claimantId, tropics.id, {
      name: 'Sunday Sauna Social',
      starts_at: new Date(Date.now() + 3600000 * 24).toISOString(),
    }),
    /Ops approval required before managing venue calendar/i,
    'Calendar rights must be blocked before ops approval',
  );
  console.log('✓ Calendar creation blocked prior to ops approval');

  // 6. Ops Review Gate: Ops approves the claim
  const pendingClaims = await venueClaimService.listPendingClaims();
  const pendingTropics = pendingClaims.find((c) => c.id === claim.id);
  assert.ok(pendingTropics, 'Pending claim must be visible to ops queue');
  assert.strictEqual(pendingTropics.spot_name, tropics.name);

  const approvedClaim = await venueClaimService.approveClaim(
    claim.id,
    'ops-reviewer-1',
    'Commercial proof hand-checked. Approved.',
  );
  assert.strictEqual(approvedClaim.status, 'approved');
  assert.strictEqual(approvedClaim.reviewed_by, 'ops-reviewer-1');

  // Verify hot spot metadata updated
  const spotAfterApprove = await hotSpotsService.getSpot(claimantId, tropics.id);
  assert.ok(spotAfterApprove);
  assert.strictEqual(spotAfterApprove.claim_status, 'approved');
  assert.strictEqual(spotAfterApprove.is_calendar_managed, true);
  assert.strictEqual(spotAfterApprove.can_manage_calendar, true);
  console.log('✓ Ops approval succeeded: Tropics Day Spa claim approved & calendar rights granted');

  // 7. Venue Calendar CRUD: Create event
  const tomorrow = new Date(Date.now() + 3600000 * 24);
  const tomorrowEnd = new Date(Date.now() + 3600000 * 28);
  const event = await venueCalendarService.createEvent(claimantId, tropics.id, {
    name: 'Tropics Sunday Bear Session',
    description: 'Exclusive afternoon steam & sauna social in Portsmouth. 18+ only.',
    starts_at: tomorrow.toISOString(),
    ends_at: tomorrowEnd.toISOString(),
    ticket_url: 'https://tropicsdayspa.co.uk/events/sunday',
  });
  assert.ok(event.id);
  assert.strictEqual(event.name, 'Tropics Sunday Bear Session');
  assert.strictEqual(event.venue_name, tropics.name);
  assert.strictEqual(event.is_venue_managed, true);
  assert.strictEqual(event.managed_label, 'Calendar managed by venue');
  console.log(`✓ Event created: ${event.name} (id: ${event.id})`);

  // 8. Verify Event appears on public Events Discovery
  // Location of Tropics Portsmouth is lat: 50.8035933, lng: -1.0881303
  const nearbyEvents = await eventService.getNearbyEvents({
    lat: Number(tropics.latitude),
    lng: Number(tropics.longitude),
    radiusKm: 20,
    daysAhead: 7,
  });
  const foundInDiscovery = nearbyEvents.find((e) => e.id === event.id);
  assert.ok(foundInDiscovery, 'Event must appear in nearby events discovery');
  assert.strictEqual(foundInDiscovery.is_venue_managed, true);
  assert.strictEqual(foundInDiscovery.managed_label, 'Calendar managed by venue');
  assert.strictEqual(foundInDiscovery.venue_name, tropics.name);

  // STRICT FACE COPY CHECK:
  const jsonStr = JSON.stringify(foundInDiscovery).toLowerCase();
  assert.ok(!jsonStr.includes('verified business'), 'NEVER say Verified Business');
  assert.ok(!jsonStr.includes('official partner'), 'NEVER say Official Partner');
  assert.ok(!jsonStr.includes('sponsored'), 'NEVER say Sponsored');
  assert.ok(!jsonStr.includes('endorsed'), 'NEVER say Endorsed');
  console.log('✓ Verified quiet face copy: "Calendar managed by venue" / No "Verified Business"');

  // 9. Venue Calendar CRUD: Update event
  const updatedEvent = await venueCalendarService.updateEvent(claimantId, tropics.id, event.id, {
    name: 'Tropics Sunday Steam & Spa Party',
    description: 'Updated description for afternoon sauna session.',
  });
  assert.strictEqual(updatedEvent.name, 'Tropics Sunday Steam & Spa Party');
  console.log('✓ Event updated successfully');

  // 10. Venue Calendar CRUD: Cancel event
  const cancelledEvent = await venueCalendarService.cancelEvent(claimantId, tropics.id, event.id, {
    cancellation_reason: 'Scheduled maintenance work on plunge pool.',
  });
  assert.strictEqual(cancelledEvent.status, 'cancelled');
  assert.strictEqual(cancelledEvent.cancellation_reason, 'Scheduled maintenance work on plunge pool.');
  console.log('✓ Event cancelled successfully');

  // Verify cancelled event no longer appears in public active discovery
  const nearbyAfterCancel = await eventService.getNearbyEvents({
    lat: Number(tropics.latitude),
    lng: Number(tropics.longitude),
    radiusKm: 20,
  });
  assert.ok(!nearbyAfterCancel.find((e) => e.id === event.id), 'Cancelled event must not appear in public active discovery');
  console.log('✓ Cancelled event filtered out of public active discovery');

  // 11. Test Dispute / Freeze path
  const disputeUser = randomUUID();
  await query(
    `INSERT INTO users (id, email, password_hash, name, age)
     VALUES ($1, 'disputer@example.com', 'x', 'Dispute Party', 40)`,
    [disputeUser],
  );

  const dispute = await venueClaimService.disputeClaim(disputeUser, tropics.id, {
    dispute_reason: 'Current claimant does not have legal standing to represent Tropics Day Spa.',
  });
  assert.strictEqual(dispute.status, 'disputed');

  const spotAfterDispute = await hotSpotsService.getSpot(claimantId, tropics.id);
  assert.strictEqual(spotAfterDispute!.claim_status, 'disputed');
  assert.strictEqual(spotAfterDispute!.is_calendar_managed, false);

  // While disputed, calendar actions must be blocked
  await assert.rejects(
    venueCalendarService.createEvent(claimantId, tropics.id, {
      name: 'Unauthorized event during dispute',
      starts_at: new Date(Date.now() + 3600000 * 48).toISOString(),
    }),
    /Ops approval required before managing venue calendar/i,
    'Calendar management must be suspended during dispute',
  );
  console.log('✓ Dispute path verified: calendar rights suspended');

  // 12. Test Ops Freeze / False-Claim Ban Path
  const frozen = await venueClaimService.freezeClaim(claim.id, 'ops-security', {
    frozen_reason: 'False representation verified after dispute investigation',
    ban_user: true,
  });
  assert.strictEqual(frozen.status, 'frozen');

  const userRes = await query(`SELECT is_frozen, frozen_reason FROM users WHERE id = $1`, [claimantId]);
  assert.strictEqual(userRes.rows[0].is_frozen, true);
  assert.ok(userRes.rows[0].frozen_reason.includes('False venue claim ban'));
  console.log('✓ False-claim ban path verified: user account frozen');

  // Clean up test data
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
  await query(`DELETE FROM users WHERE id IN ($1, $2)`, [claimantId, disputeUser]);

  console.log('--- All Venue Calendar Tropics Tests Passed Successfully ---');
}

run()
  .then(() => {
    pool.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error('Test failed with error:', err);
    pool.end();
    process.exit(1);
  });
