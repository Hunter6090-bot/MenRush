/**
 * Cruising Search Phase 2 verification checks.
 * Run: npx ts-node scripts/cruising-phase2-checks.ts
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import pool from '../src/db';
import {
  OUTDOOR_CHECKIN_TTL_HOURS,
  ACTIVE_CHECKIN_TTL_HOURS,
  OUTDOOR_HOT_SPOT_CATEGORY_SLUGS,
  hotSpotsService,
} from '../src/services/hot-spots.service';

async function run() {
  console.log('Running cruising-phase2-checks...');

  // 1. Verify TTL values
  assert.strictEqual(OUTDOOR_CHECKIN_TTL_HOURS, 2, 'Outdoor cruising checkin TTL must be 2 hours');
  assert.strictEqual(ACTIVE_CHECKIN_TTL_HOURS, 4, 'Commercial checkin TTL must be 4 hours');
  console.log('✓ TTL constants verified: 2h outdoor, 4h commercial');

  // 2. Verify migration 065 files exist in both locations and are identical
  const rootMigPath = path.join(
    __dirname,
    '../../database/migrations/065_hot_spot_reviews.sql',
  );
  const backendMigPath = path.join(
    __dirname,
    '../database/migrations/065_hot_spot_reviews.sql',
  );
  assert.ok(fs.existsSync(rootMigPath), '065 migration must exist in database/migrations');
  assert.ok(fs.existsSync(backendMigPath), '065 migration must exist in backend/database/migrations');

  const rootSql = fs.readFileSync(rootMigPath, 'utf8');
  const backendSql = fs.readFileSync(backendMigPath, 'utf8');
  assert.strictEqual(rootSql, backendSql, 'Both 065 migration files must be identical');

  assert.match(rootSql, /CREATE TABLE IF NOT EXISTS hot_spot_reviews/);
  assert.match(rootSql, /rating SMALLINT NOT NULL CHECK \(rating >= 1 AND rating <= 5\)/);
  assert.match(rootSql, /is_anonymous BOOLEAN NOT NULL DEFAULT TRUE/);
  assert.match(rootSql, /uq_hot_spot_reviews_user_spot UNIQUE \(spot_id, user_id\)/);
  console.log('✓ Migration 065 SQL structure verified');

  // 3. Database tests if connected
  if (process.env.DATABASE_URL) {
    // Find or pick a test spot (e.g. Wisley or Hog's Back)
    const spotRes = await pool.query(
      `SELECT hs.id, hs.name, c.slug as category_slug
         FROM hot_spots hs
         JOIN hot_spot_categories c ON c.id = hs.category_id
        WHERE hs.name = 'Wisley (Ockham Common)'
        LIMIT 1`,
    );

    if (spotRes.rows.length > 0) {
      const spot = spotRes.rows[0];
      const spotId = spot.id;

      // Find or create test user
      let userRes = await pool.query(
        `SELECT id FROM users WHERE email = 'test-cruiser-phase2@menrush.test' LIMIT 1`,
      );
      let testUserId: string;
      if (userRes.rows.length > 0) {
        testUserId = userRes.rows[0].id;
      } else {
        const insUser = await pool.query(
          `INSERT INTO users (id, email, password_hash, name, age, is_verified)
           VALUES (gen_random_uuid(), 'test-cruiser-phase2@menrush.test', 'testhash', 'Test Cruiser', 25, TRUE)
           RETURNING id`,
        );
        testUserId = insUser.rows[0].id;
      }

      // Test Anonymous Check-in (2h TTL)
      const checkedInSpot = await hotSpotsService.checkIn(testUserId, spotId, true);
      assert.ok(checkedInSpot, 'Spot must be returned after check-in');
      assert.strictEqual(checkedInSpot.is_checked_in, true, 'Spot is_checked_in must be true');
      assert.strictEqual(checkedInSpot.my_checkin_anonymous, true, 'Check-in must be anonymous');
      assert.strictEqual(checkedInSpot.checkin_ttl_hours, 2, 'Outdoor spot checkin_ttl_hours must be 2');
      assert.strictEqual(checkedInSpot.has_active_checkins, true, 'has_active_checkins must be true');
      assert.ok(checkedInSpot.last_activity_at, 'last_activity_at must be populated after real check-in');
      console.log('✓ Anonymous check-in at outdoor spot verified with 2h TTL');

      // Test Reviews - Add review (rating 5 + short text)
      const reviewText = 'Great woodland paths and quiet atmosphere.';
      const addRes = await hotSpotsService.addOrUpdateReview(
        testUserId,
        spotId,
        5,
        reviewText,
        true,
      );
      assert.ok(addRes.review, 'Review must be created');
      assert.strictEqual(addRes.review.rating, 5);
      assert.strictEqual(addRes.review.body, reviewText);
      assert.strictEqual(addRes.review.is_anonymous, true);

      // List reviews
      const listRes = await hotSpotsService.listReviews(spotId, testUserId);
      assert.ok(listRes.reviews.length >= 1, 'Should have at least 1 review');
      const found = listRes.reviews.find((r) => r.id === addRes.review.id);
      assert.ok(found, 'Created review must be present in list');
      assert.strictEqual(found.rating, 5);
      assert.strictEqual(found.author_name, 'Anonymous', 'Anonymous review must have author_name Anonymous');
      assert.strictEqual(found.is_mine, true, 'is_mine must be true for author');
      assert.ok(listRes.rating_avg !== null, 'rating_avg must be calculated');
      assert.ok(listRes.review_count >= 1, 'review_count must be at least 1');
      console.log('✓ Review creation (1-5 + short text + anonymous) and listing verified');

      // Update review (upsert)
      const updatedText = 'Updated review: great visibility and clean paths.';
      await hotSpotsService.addOrUpdateReview(
        testUserId,
        spotId,
        4,
        updatedText,
        true,
      );
      const listUpdated = await hotSpotsService.listReviews(spotId, testUserId);
      const updatedReview = listUpdated.reviews.find((r) => r.user_id === testUserId);
      assert.ok(updatedReview, 'Updated review must be found');
      assert.strictEqual(updatedReview.rating, 4);
      assert.strictEqual(updatedReview.body, updatedText);
      console.log('✓ Review upsert verified');

      // Delete review
      await hotSpotsService.deleteReview(testUserId, spotId, addRes.review.id);
      const listAfterDelete = await hotSpotsService.listReviews(spotId, testUserId);
      const deletedReview = listAfterDelete.reviews.find((r) => r.user_id === testUserId);
      assert.strictEqual(deletedReview, undefined, 'Review must be deleted');
      console.log('✓ Review deletion verified');

      // Check-out
      await hotSpotsService.checkOut(testUserId, spotId);
      const spotAfterCheckOut = await hotSpotsService.getSpot(testUserId, spotId);
      assert.strictEqual(spotAfterCheckOut?.is_checked_in, false, 'User must be checked out');
      console.log('✓ Check-out verified');
    }
  }

  console.log('cruising-phase2-checks: all checks passed successfully!');
  await pool.end();
}

run().catch((err) => {
  console.error('cruising-phase2-checks failed:', err);
  process.exit(1);
});
