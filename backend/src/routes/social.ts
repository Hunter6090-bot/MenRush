/**
 * /api/social — social media automation: reusable templates, a cross-platform
 * content calendar, and a mandatory human-approval gate.
 *
 * Every route here is gated by X-Admin-Token. This is an internal ops
 * surface, not a public one — draft copy shouldn't be readable pre-approval,
 * and nothing here ever calls out to a social platform or Buffer. Publishing
 * happens outside this system; `/posts/:id/publish` only records that a
 * human already did it. See docs/AI_TEAM.md rule 11.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  socialService,
  SOCIAL_PLATFORMS,
  SOCIAL_POST_STATUSES,
} from '../services/social.service';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Auth helper (mirrors campaigns.ts's requireAdminToken)
// ─────────────────────────────────────────────────────────────────────────────

function requireAdminToken(req: Request, res: Response): boolean {
  const expected = process.env.ADMIN_TOKEN?.trim();
  if (!expected) {
    res.status(503).json({ error: 'Admin token not configured on server.' });
    return false;
  }
  if (req.headers['x-admin-token'] !== expected) {
    res.status(403).json({ error: 'Forbidden.' });
    return false;
  }
  return true;
}

router.use((req: Request, res: Response, next: NextFunction) => {
  if (!requireAdminToken(req, res)) return;
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

const platformEnum = z.enum(SOCIAL_PLATFORMS);
const statusEnum = z.enum(SOCIAL_POST_STATUSES);

const TemplateVariableSchema = z.object({
  key: z.string().min(1),
  label: z.string().optional(),
  default: z.string().optional(),
});

const CreateTemplateSchema = z.object({
  slug: z.string().min(1).trim(),
  name: z.string().min(1).trim(),
  category: z.string().min(1).trim().optional(),
  platforms: z.array(platformEnum).optional(),
  bodyTemplate: z.string().min(1),
  variables: z.array(TemplateVariableSchema).optional(),
  defaultHashtags: z.array(z.string()).optional(),
  mediaNote: z.string().optional(),
  createdBy: z.string().min(1).trim(),
});

const CreatePostSchema = z
  .object({
    templateId: z.string().uuid().optional(),
    platform: platformEnum,
    variables: z.record(z.string()).optional(),
    renderedBody: z.string().min(1).optional(),
    campaign: z.string().min(1).trim().optional(),
    hashtags: z.array(z.string()).optional(),
    mediaUrls: z.array(z.string()).optional(),
    linkUrl: z.string().url().optional(),
    scheduledFor: z.coerce.date().optional(),
    createdBy: z.string().min(1).trim(),
  })
  .refine((data) => data.templateId || data.renderedBody, {
    message: 'Either templateId or renderedBody is required.',
  });

const ApproveSchema = z.object({
  approvedBy: z.string().min(1).trim(),
  scheduledFor: z.coerce.date().optional(),
});

const RejectSchema = z.object({
  reason: z.string().min(1).trim(),
});

const PublishSchema = z.object({
  publishedVia: z.enum(['manual', 'buffer']),
  externalPostId: z.string().optional(),
});

const EngagementSchema = z.object({
  stats: z.record(z.number()),
});

// ─────────────────────────────────────────────────────────────────────────────
// Templates
// ─────────────────────────────────────────────────────────────────────────────

router.post('/templates', async (req: Request, res: Response) => {
  const parsed = CreateTemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid request.' });
    return;
  }
  try {
    const template = await socialService.createTemplate(parsed.data);
    res.status(201).json(template);
  } catch (err: any) {
    console.error('[social] createTemplate error:', err);
    res.status(500).json({ error: 'Could not create template.' });
  }
});

router.get('/templates', async (req: Request, res: Response) => {
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  const includeArchived = req.query.includeArchived === 'true';
  try {
    const templates = await socialService.listTemplates({ category, includeArchived });
    res.json(templates);
  } catch (err) {
    console.error('[social] listTemplates error:', err);
    res.status(500).json({ error: 'Could not list templates.' });
  }
});

router.get('/templates/:id', async (req: Request, res: Response) => {
  const parsedId = z.string().uuid().safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json({ error: 'Invalid template id.' });
    return;
  }
  try {
    const template = await socialService.getTemplate(parsedId.data);
    if (!template) {
      res.status(404).json({ error: 'Template not found.' });
      return;
    }
    res.json(template);
  } catch (err) {
    console.error('[social] getTemplate error:', err);
    res.status(500).json({ error: 'Could not fetch template.' });
  }
});

router.post('/templates/:id/archive', async (req: Request, res: Response) => {
  const parsedId = z.string().uuid().safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json({ error: 'Invalid template id.' });
    return;
  }
  try {
    await socialService.archiveTemplate(parsedId.data);
    res.json({ ok: true });
  } catch (err) {
    console.error('[social] archiveTemplate error:', err);
    res.status(500).json({ error: 'Could not archive template.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Posts
// ─────────────────────────────────────────────────────────────────────────────

router.post('/posts', async (req: Request, res: Response) => {
  const parsed = CreatePostSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid request.' });
    return;
  }
  try {
    const post = await socialService.createPost(parsed.data);
    res.status(201).json(post);
  } catch (err: any) {
    if (err.message?.startsWith('Unknown template') || err.message?.startsWith('Cannot create post')) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error('[social] createPost error:', err);
    res.status(500).json({ error: 'Could not create post.' });
  }
});

router.get('/posts', async (req: Request, res: Response) => {
  const statusParsed = statusEnum.safeParse(req.query.status);
  const platformParsed = platformEnum.safeParse(req.query.platform);
  const campaign = typeof req.query.campaign === 'string' ? req.query.campaign : undefined;

  try {
    const posts = await socialService.listPosts({
      status: statusParsed.success ? statusParsed.data : undefined,
      platform: platformParsed.success ? platformParsed.data : undefined,
      campaign,
    });
    res.json(posts);
  } catch (err) {
    console.error('[social] listPosts error:', err);
    res.status(500).json({ error: 'Could not list posts.' });
  }
});

router.get('/posts/:id', async (req: Request, res: Response) => {
  const parsedId = z.string().uuid().safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json({ error: 'Invalid post id.' });
    return;
  }
  try {
    const post = await socialService.getPost(parsedId.data);
    if (!post) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }
    res.json(post);
  } catch (err) {
    console.error('[social] getPost error:', err);
    res.status(500).json({ error: 'Could not fetch post.' });
  }
});

router.post('/posts/:id/submit', async (req: Request, res: Response) => {
  const parsedId = z.string().uuid().safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json({ error: 'Invalid post id.' });
    return;
  }
  try {
    const post = await socialService.submitForApproval(parsedId.data);
    res.json(post);
  } catch (err: any) {
    if (err.message?.startsWith('Cannot submit') || err.message?.startsWith('Unknown post')) {
      res.status(409).json({ error: err.message });
      return;
    }
    console.error('[social] submitForApproval error:', err);
    res.status(500).json({ error: 'Could not submit post.' });
  }
});

router.post('/posts/:id/approve', async (req: Request, res: Response) => {
  const parsedId = z.string().uuid().safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json({ error: 'Invalid post id.' });
    return;
  }
  const parsed = ApproveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid request.' });
    return;
  }
  try {
    const post = await socialService.approve(parsedId.data, parsed.data.approvedBy, parsed.data.scheduledFor);
    res.json(post);
  } catch (err: any) {
    if (err.message?.startsWith('Cannot approve') || err.message?.startsWith('Unknown post')) {
      res.status(409).json({ error: err.message });
      return;
    }
    console.error('[social] approve error:', err);
    res.status(500).json({ error: 'Could not approve post.' });
  }
});

router.post('/posts/:id/reject', async (req: Request, res: Response) => {
  const parsedId = z.string().uuid().safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json({ error: 'Invalid post id.' });
    return;
  }
  const parsed = RejectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid request.' });
    return;
  }
  try {
    const post = await socialService.reject(parsedId.data, parsed.data.reason);
    res.json(post);
  } catch (err: any) {
    if (err.message?.startsWith('Cannot reject') || err.message?.startsWith('Unknown post')) {
      res.status(409).json({ error: err.message });
      return;
    }
    console.error('[social] reject error:', err);
    res.status(500).json({ error: 'Could not reject post.' });
  }
});

router.post('/posts/:id/publish', async (req: Request, res: Response) => {
  const parsedId = z.string().uuid().safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json({ error: 'Invalid post id.' });
    return;
  }
  const parsed = PublishSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid request.' });
    return;
  }
  try {
    const post = await socialService.markPublished(parsedId.data, parsed.data);
    res.json(post);
  } catch (err: any) {
    if (err.message?.startsWith('Cannot mark published') || err.message?.startsWith('Unknown post')) {
      res.status(409).json({ error: err.message });
      return;
    }
    console.error('[social] markPublished error:', err);
    res.status(500).json({ error: 'Could not mark post published.' });
  }
});

router.patch('/posts/:id/engagement', async (req: Request, res: Response) => {
  const parsedId = z.string().uuid().safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json({ error: 'Invalid post id.' });
    return;
  }
  const parsed = EngagementSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid request.' });
    return;
  }
  try {
    const post = await socialService.recordEngagement(parsedId.data, parsed.data.stats);
    res.json(post);
  } catch (err: any) {
    if (err.message?.startsWith('Unknown post')) {
      res.status(404).json({ error: err.message });
      return;
    }
    console.error('[social] recordEngagement error:', err);
    res.status(500).json({ error: 'Could not record engagement.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Stats
// ─────────────────────────────────────────────────────────────────────────────

router.get('/stats', async (req: Request, res: Response) => {
  const campaign = typeof req.query.campaign === 'string' ? req.query.campaign : undefined;
  const platformParsed = platformEnum.safeParse(req.query.platform);
  try {
    const stats = await socialService.stats({
      campaign,
      platform: platformParsed.success ? platformParsed.data : undefined,
    });
    res.json(stats);
  } catch (err) {
    console.error('[social] stats error:', err);
    res.status(500).json({ error: 'Could not fetch stats.' });
  }
});

export default router;
