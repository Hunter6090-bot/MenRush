import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { AuthRequest, authMiddleware, verifiedMiddleware } from '../middleware/auth';
import { hotSpotsService } from '../services/hot-spots.service';
import { venueClaimService } from '../services/venue-claim.service';
import { venueCalendarService } from '../services/venue-calendar.service';
import {
  LocationSchema,
  SubmitVenueClaimSchema,
  DisputeVenueClaimSchema,
  VenueCalendarEventCreateSchema,
  VenueCalendarEventUpdateSchema,
  VenueCalendarEventCancelSchema,
} from '../types/validation';

const router = Router();
router.use(authMiddleware, verifiedMiddleware);

const checkInLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many check-ins. Try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const claimLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many claim requests. Try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const CheckInSchema = z.object({
  anonymous: z.boolean().optional().default(false),
});

router.get('/categories', async (_req: AuthRequest, res: Response) => {
  try {
    const categories = await hotSpotsService.listCategories();
    res.json({ categories });
  } catch (err: unknown) {
    console.error('[hot-spots] categories', err);
    res.status(500).json({ error: 'Could not load categories' });
  }
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const location = LocationSchema.parse({
      lat: parseFloat(String(req.query.lat)),
      lng: parseFloat(String(req.query.lng)),
    });
    const radius = req.query.radiusKm ? parseFloat(String(req.query.radiusKm)) : undefined;
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const cruisingOnly = req.query.cruising === 'true';
    const outdoorOnly = !cruisingOnly && (req.query.outdoor === 'true' || req.query.outdoorOnly === 'true');
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const sort =
      req.query.sort === 'closest' ? 'closest' : req.query.sort === 'live' ? 'live' : undefined;
    const limit = req.query.limit
      ? Math.min(Math.max(parseInt(String(req.query.limit), 10), 1), 100)
      : undefined;

    const spots = await hotSpotsService.listNearby({
      userId: req.userId!,
      lat: location.lat,
      lng: location.lng,
      radiusKm: radius ? Math.min(Math.max(radius, 1), 500) : undefined,
      categorySlug: category,
      outdoorOnly,
      cruisingOnly,
      query: q,
      sortBy: sort ?? (outdoorOnly || cruisingOnly ? 'closest' : 'live'),
      limit,
    });
    res.json({
      spots,
      privacy: {
        venueCoordinatesOnly: true,
        liveCountsRoundedForFree: true,
        checkInsAnonymousOption: true,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid request';
    res.status(400).json({ error: message });
  }
});

router.get('/me/check-in', async (req: AuthRequest, res: Response) => {
  try {
    const checkIn = await hotSpotsService.getMyCheckIn(req.userId!);
    res.json({ check_in: checkIn });
  } catch (err: unknown) {
    console.error('[hot-spots] me', err);
    res.status(500).json({ error: 'Could not load check-in' });
  }
});

router.get('/my/claims', async (req: AuthRequest, res: Response) => {
  try {
    const claims = await venueClaimService.listUserClaims(req.userId!);
    res.json({ claims });
  } catch (err: unknown) {
    console.error('[hot-spots] my claims', err);
    res.status(500).json({ error: 'Could not load your claims' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const spot = await hotSpotsService.getSpot(req.userId!, req.params.id);
    if (!spot) return res.status(404).json({ error: 'Spot not found' });
    res.json({ spot });
  } catch (err: unknown) {
    console.error('[hot-spots] get', err);
    res.status(500).json({ error: 'Could not load spot' });
  }
});

router.post('/:id/check-in', checkInLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const body = CheckInSchema.parse(req.body ?? {});
    const spot = await hotSpotsService.checkIn(req.userId!, req.params.id, body.anonymous);
    res.json({ ok: true, spot });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Check-in failed';
    const status = message === 'Spot not found' ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

router.post('/:id/check-out', async (req: AuthRequest, res: Response) => {
  try {
    await hotSpotsService.checkOut(req.userId!, req.params.id);
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(400).json({ error: 'Check-out failed' });
  }
});

router.post('/check-out', async (req: AuthRequest, res: Response) => {
  try {
    await hotSpotsService.checkOut(req.userId!);
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(400).json({ error: 'Check-out failed' });
  }
});

/**
 * GET /api/hot-spots/:id/claim
 * Get claim status for a spot (and caller's claim if any).
 */
router.get('/:id/claim', async (req: AuthRequest, res: Response) => {
  try {
    const claim = await venueClaimService.getClaimForSpot(req.params.id, req.userId!);
    res.json(claim);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Could not check claim status';
    const status = message === 'Venue not found' ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

/**
 * POST /api/hot-spots/:id/claim
 * Submit claim for an EXISTING commercial venue pin.
 * Ops-approval gate (status: pending).
 * Requires legal attestation agreement.
 */
router.post('/:id/claim', claimLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const input = SubmitVenueClaimSchema.parse(req.body ?? {});
    const claim = await venueClaimService.submitClaim(req.userId!, req.params.id, input);
    res.status(201).json({
      ok: true,
      claim,
      message: 'Venue claim submitted. Ops review is required before calendar management rights are granted.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Claim submission failed';
    const status = message === 'Venue not found' ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

/**
 * POST /api/hot-spots/:id/claim/dispute
 * Dispute an existing claim on a venue.
 */
router.post('/:id/claim/dispute', claimLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const input = DisputeVenueClaimSchema.parse(req.body ?? {});
    const claim = await venueClaimService.disputeClaim(req.userId!, req.params.id, input);
    res.json({
      ok: true,
      claim,
      message: 'Venue dispute submitted. Venue calendar has been temporarily frozen pending ops review.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Dispute submission failed';
    const status = message === 'Venue not found' ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

/**
 * GET /api/hot-spots/:id/events
 * List scheduled calendar events for a venue.
 */
router.get('/:id/events', async (req: AuthRequest, res: Response) => {
  try {
    const spot = await hotSpotsService.getSpot(req.userId!, req.params.id);
    if (!spot) return res.status(404).json({ error: 'Spot not found' });

    // Include cancelled events only if the requester is the approved manager
    const includeCancelled = Boolean(spot.can_manage_calendar);
    const events = await venueCalendarService.listVenueEvents(req.params.id, { includeCancelled });
    res.json({
      events,
      venue_name: spot.name,
      is_claimed: spot.claim_status === 'approved',
      can_manage: spot.can_manage_calendar,
      managed_label: 'Calendar managed by venue',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Could not load venue events';
    res.status(400).json({ error: message });
  }
});

/**
 * POST /api/hot-spots/:id/events
 * Create a new event on the venue calendar.
 * Requires approved venue claim (ops-approve gate).
 */
router.post('/:id/events', async (req: AuthRequest, res: Response) => {
  try {
    const input = VenueCalendarEventCreateSchema.parse(req.body ?? {});
    const event = await venueCalendarService.createEvent(req.userId!, req.params.id, input);
    res.status(201).json({ ok: true, event });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create venue event';
    const status = message.includes('Ops approval required') ? 403 : message === 'Venue not found' ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

/**
 * PATCH /api/hot-spots/:id/events/:eventId
 * Update an existing venue calendar event.
 */
router.patch('/:id/events/:eventId', async (req: AuthRequest, res: Response) => {
  try {
    const input = VenueCalendarEventUpdateSchema.parse(req.body ?? {});
    const event = await venueCalendarService.updateEvent(req.userId!, req.params.id, req.params.eventId, input);
    res.json({ ok: true, event });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update venue event';
    const status = message.includes('Ops approval required') || message.includes('Not authorized') ? 403 : message === 'Event not found' ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

/**
 * POST /api/hot-spots/:id/events/:eventId/cancel
 * Cancel an event on the venue calendar.
 */
router.post('/:id/events/:eventId/cancel', async (req: AuthRequest, res: Response) => {
  try {
    const input = VenueCalendarEventCancelSchema.parse(req.body ?? {});
    const event = await venueCalendarService.cancelEvent(req.userId!, req.params.id, req.params.eventId, input);
    res.json({ ok: true, event });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to cancel venue event';
    const status = message.includes('Ops approval required') || message.includes('Not authorized') ? 403 : message === 'Event not found' ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

export default router;