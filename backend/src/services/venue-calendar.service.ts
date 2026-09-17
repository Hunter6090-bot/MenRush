import { v4 as uuidv4 } from 'uuid';
import { query } from '../db';
import {
  VenueCalendarEventCreateInput,
  VenueCalendarEventUpdateInput,
  VenueCalendarEventCancelInput,
} from '../types/validation';

/**
 * Venue Calendar Events.
 *
 * Venue calendar events are stored in the `rooms` table with:
 *   kind = 'event'
 *   spot_id = <hot_spots.id>
 *   venue_claim_id = <venue_claims.id>
 *   is_venue_managed = TRUE
 *   status = 'published' | 'cancelled'
 *
 * Rules:
 *   - Only an approved venue claim holder can create/edit/cancel events for that venue.
 *   - Operations gate ensures ops approval before publishing or calendar rights.
 *   - Face copy constraint: "Venue claimed" / "Calendar managed by venue". NEVER Verified Business.
 *   - Venue posts = UGC (User Generated Content).
 *   - Outdoor soft-sell RED — venue calendar is commercial only.
 */

export interface VenueCalendarEventRow {
  id: string;
  spot_id: string;
  venue_claim_id: string;
  name: string;
  description: string | null;
  venue_name: string | null;
  starts_at: string;
  ends_at: string | null;
  lat: number;
  lng: number;
  status: 'published' | 'cancelled' | 'draft';
  is_venue_managed: boolean;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  ticket_url: string | null;
  member_count: number;
  distance_m: number | null;
  is_live: boolean;
  created_at: string;
  updated_at: string;
  // Quiet face badge copy
  managed_label: 'Calendar managed by venue';
}

export const venueCalendarService = {
  /**
   * Helper to verify that a user has approved claim rights on a spot.
   */
  async verifyVenueManager(userId: string, spotId: string): Promise<{
    claimId: string;
    spot: { id: string; name: string; latitude: number; longitude: number; is_commercial: boolean; city: string | null };
  }> {
    // 1. Verify user is not frozen
    const userRes = await query(`SELECT is_frozen FROM users WHERE id = $1`, [userId]);
    if (userRes.rows[0]?.is_frozen) {
      throw new Error('Your account is restricted from managing venue events.');
    }

    // 2. Query spot and active claim
    const res = await query(
      `SELECT hs.id, hs.name, hs.latitude, hs.longitude, hs.city, hs.claim_status,
              hs.claimed_by_user_id, hs.is_calendar_managed, c.is_commercial,
              vc.id AS claim_id, vc.status AS claim_status_val
         FROM hot_spots hs
         JOIN hot_spot_categories c ON c.id = hs.category_id
         LEFT JOIN venue_claims vc ON vc.spot_id = hs.id AND vc.user_id = $1 AND vc.status = 'approved'
        WHERE hs.id = $2 AND hs.is_active = TRUE`,
      [userId, spotId],
    );

    const row = res.rows[0];
    if (!row) throw new Error('Venue not found');
    if (!row.is_commercial) {
      throw new Error('Only commercial venues support managed calendars');
    }
    if (row.claim_status !== 'approved' || !row.is_calendar_managed || row.claimed_by_user_id !== userId || !row.claim_id) {
      throw new Error('Ops approval required before managing venue calendar events');
    }

    return {
      claimId: row.claim_id,
      spot: {
        id: row.id,
        name: row.name,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        is_commercial: Boolean(row.is_commercial),
        city: row.city,
      },
    };
  },

  /**
   * Create a venue calendar event (UGC by venue manager)
   */
  async createEvent(
    userId: string,
    spotId: string,
    input: VenueCalendarEventCreateInput,
  ): Promise<VenueCalendarEventRow> {
    const { claimId, spot } = await this.verifyVenueManager(userId, spotId);

    const eventId = uuidv4();
    const lat = spot.latitude;
    const lng = spot.longitude;

    const res = await query(
      `INSERT INTO rooms (
         id, name, description, created_by, is_location_based, is_official,
         kind, venue_name, spot_id, venue_claim_id, is_venue_managed,
         status, starts_at, ends_at, lat, lng, location,
         created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, TRUE, FALSE,
         'event', $5, $6, $7, TRUE,
         'published', $8::timestamp, $9::timestamp, $10::double precision, $11::double precision,
         ST_SetSRID(ST_MakePoint($11::double precision, $10::double precision), 4326)::geography,
         NOW(), NOW()
       )
       RETURNING id, name, description, venue_name, spot_id, venue_claim_id,
                 is_venue_managed, status, starts_at, ends_at, lat, lng,
                 created_at, updated_at`,
      [
        eventId,
        input.name,
        input.description || null,
        userId,
        spot.name,
        spotId,
        claimId,
        input.starts_at,
        input.ends_at || null,
        lat,
        lng,
      ],
    );

    const created = res.rows[0];
    return {
      ...created,
      ticket_url: input.ticket_url || null,
      member_count: 0,
      distance_m: null,
      is_live: new Date(created.starts_at) <= new Date() && (!created.ends_at || new Date(created.ends_at) > new Date()),
      cancelled_at: null,
      cancellation_reason: null,
      managed_label: 'Calendar managed by venue',
    };
  },

  /**
   * Update an existing venue calendar event
   */
  async updateEvent(
    userId: string,
    spotId: string,
    eventId: string,
    input: VenueCalendarEventUpdateInput,
  ): Promise<VenueCalendarEventRow> {
    const { claimId } = await this.verifyVenueManager(userId, spotId);

    const existingRes = await query(
      `SELECT id, status, is_venue_managed, venue_claim_id, starts_at, ends_at
         FROM rooms
        WHERE id = $1 AND spot_id = $2 AND kind = 'event'`,
      [eventId, spotId],
    );
    const existing = existingRes.rows[0];
    if (!existing) throw new Error('Event not found');
    if (!existing.is_venue_managed || existing.venue_claim_id !== claimId) {
      throw new Error('Not authorized to edit this event');
    }

    const updates: string[] = [];
    const values: unknown[] = [eventId, spotId];

    if (input.name !== undefined) {
      values.push(input.name);
      updates.push(`name = $${values.length}`);
    }
    if (input.description !== undefined) {
      values.push(input.description || null);
      updates.push(`description = $${values.length}`);
    }
    if (input.starts_at !== undefined) {
      values.push(input.starts_at);
      updates.push(`starts_at = $${values.length}::timestamp`);
    }
    if (input.ends_at !== undefined) {
      values.push(input.ends_at || null);
      updates.push(`ends_at = $${values.length}::timestamp`);
    }

    updates.push(`updated_at = NOW()`);

    const res = await query(
      `UPDATE rooms
          SET ${updates.join(', ')}
        WHERE id = $1 AND spot_id = $2
        RETURNING id, name, description, venue_name, spot_id, venue_claim_id,
                  is_venue_managed, status, starts_at, ends_at, lat, lng,
                  cancelled_at, cancellation_reason, created_at, updated_at`,
      values,
    );

    const updated = res.rows[0];
    return {
      ...updated,
      ticket_url: input.ticket_url ?? null,
      member_count: 0,
      distance_m: null,
      is_live: new Date(updated.starts_at) <= new Date() && (!updated.ends_at || new Date(updated.ends_at) > new Date()),
      managed_label: 'Calendar managed by venue',
    };
  },

  /**
   * Cancel an event on the venue calendar
   */
  async cancelEvent(
    userId: string,
    spotId: string,
    eventId: string,
    input: VenueCalendarEventCancelInput,
  ): Promise<VenueCalendarEventRow> {
    const { claimId } = await this.verifyVenueManager(userId, spotId);

    const existingRes = await query(
      `SELECT id, status, is_venue_managed, venue_claim_id
         FROM rooms
        WHERE id = $1 AND spot_id = $2 AND kind = 'event'`,
      [eventId, spotId],
    );
    const existing = existingRes.rows[0];
    if (!existing) throw new Error('Event not found');
    if (!existing.is_venue_managed || existing.venue_claim_id !== claimId) {
      throw new Error('Not authorized to cancel this event');
    }

    const res = await query(
      `UPDATE rooms
          SET status = 'cancelled',
              cancelled_at = NOW(),
              cancellation_reason = $1,
              updated_at = NOW()
        WHERE id = $2 AND spot_id = $3
        RETURNING id, name, description, venue_name, spot_id, venue_claim_id,
                  is_venue_managed, status, starts_at, ends_at, lat, lng,
                  cancelled_at, cancellation_reason, created_at, updated_at`,
      [input.cancellation_reason || null, eventId, spotId],
    );

    const updated = res.rows[0];
    return {
      ...updated,
      ticket_url: null,
      member_count: 0,
      distance_m: null,
      is_live: false,
      managed_label: 'Calendar managed by venue',
    };
  },

  /**
   * List schedule events for a specific venue (includes upcoming/past/cancelled for managers,
   * published for public view)
   */
  async listVenueEvents(
    spotId: string,
    options?: { includeCancelled?: boolean; limit?: number },
  ): Promise<VenueCalendarEventRow[]> {
    const values: unknown[] = [spotId];
    let statusFilter = `AND r.status = 'published'`;
    if (options?.includeCancelled) {
      statusFilter = '';
    }

    const limit = options?.limit ?? 50;
    values.push(limit);

    const res = await query(
      `SELECT r.id, r.name, r.description, r.venue_name, r.spot_id, r.venue_claim_id,
              r.is_venue_managed, r.status, r.starts_at, r.ends_at, r.lat, r.lng,
              r.cancelled_at, r.cancellation_reason, r.created_at, r.updated_at,
              COUNT(rm.id)::int AS member_count,
              (r.starts_at IS NOT NULL AND r.starts_at <= NOW()
                AND (r.ends_at IS NULL OR r.ends_at > NOW())) AS is_live
         FROM rooms r
         LEFT JOIN room_members rm ON rm.room_id = r.id
        WHERE r.spot_id = $1
          AND r.kind = 'event'
          ${statusFilter}
        GROUP BY r.id
        ORDER BY r.starts_at ASC
        LIMIT $2`,
      values,
    );

    return res.rows.map((row) => ({
      ...row,
      ticket_url: null,
      distance_m: null,
      managed_label: 'Calendar managed by venue',
    }));
  },
};
