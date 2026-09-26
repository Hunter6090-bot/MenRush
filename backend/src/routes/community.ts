import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { AuthRequest, authMiddleware, verifiedMiddleware } from '../middleware/auth';
import { communityService } from '../services/community.service';
import {
  CommunityCreateCommentSchema,
  CommunityCreatePostSchema,
  CommunityMentionSuggestionsQuerySchema,
  CommunityUpdateCommentSchema,
  CommunityUpdatePostSchema,
  LocationSchema,
} from '../types/validation';

const router = Router();
router.use(authMiddleware, verifiedMiddleware);

const createLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many posts. Try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * GET /api/community/posts?lat=&lng=&radiusKm=
 * Nearby text-only Community feed. Free for all verified members.
 */
router.get('/posts', async (req: AuthRequest, res: Response) => {
  try {
    const location = LocationSchema.parse({
      lat: parseFloat(String(req.query.lat)),
      lng: parseFloat(String(req.query.lng)),
    });
    const radiusKm = req.query.radiusKm != null ? parseFloat(String(req.query.radiusKm)) : 10;
    const posts = await communityService.listNearby({
      viewerId: req.userId!,
      lat: location.lat,
      lng: location.lng,
      radiusKm: Number.isFinite(radiusKm) ? radiusKm : 10,
    });
    res.json({ posts });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid location' });
    }
    console.error('[community] list', err);
    res.status(400).json({ error: 'Could not load Community' });
  }
});

/**
 * POST /api/community/posts { body }
 * Create a short local text post (≤280). Requires a saved profile location.
 * Free — no premium check.
 */
router.post('/posts', createLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = CommunityCreatePostSchema.parse(req.body ?? {});
    const post = await communityService.create(req.userId!, parsed.body);
    res.status(201).json({ post });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Post must be 1–280 characters' });
    }
    const message = err instanceof Error ? err.message : 'create_failed';
    if (message === 'location_required') {
      return res.status(400).json({
        error: 'location_required',
        message: 'Turn on location so your post is local.',
      });
    }
    if (message === 'invalid_body') {
      return res.status(400).json({ error: 'Post must be 1–280 characters' });
    }
    console.error('[community] create', err);
    res.status(500).json({ error: 'Could not create post' });
  }
});

/**
 * PUT /api/community/posts/:id { body }
 * Update author's own Community post (≤280).
 */
router.put('/posts/:id', createLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const postId = PostIdParam.parse(req.params.id);
    const parsed = CommunityUpdatePostSchema.parse(req.body ?? {});
    const post = await communityService.updatePost(req.userId!, postId, parsed.body);
    res.json({ post });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Post must be 1–280 characters' });
    }
    const message = err instanceof Error ? err.message : '';
    if (message === 'post_not_found') {
      return res.status(404).json({ error: 'Post not found' });
    }
    if (message === 'forbidden') {
      return res.status(403).json({ error: 'You can only edit your own posts' });
    }
    if (message === 'invalid_body') {
      return res.status(400).json({ error: 'Post must be 1–280 characters' });
    }
    console.error('[community] update post', err);
    res.status(500).json({ error: 'Could not update post' });
  }
});

/**
 * DELETE /api/community/posts/:id
 * Delete author's own Community post.
 */
router.delete('/posts/:id', async (req: AuthRequest, res: Response) => {
  try {
    const postId = PostIdParam.parse(req.params.id);
    await communityService.deletePost(req.userId!, postId);
    res.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid post' });
    }
    const message = err instanceof Error ? err.message : '';
    if (message === 'post_not_found') {
      return res.status(404).json({ error: 'Post not found' });
    }
    if (message === 'forbidden') {
      return res.status(403).json({ error: 'You can only delete your own posts' });
    }
    console.error('[community] delete post', err);
    res.status(500).json({ error: 'Could not delete post' });
  }
});

const commentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many comments. Try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const PostIdParam = z.string().uuid();

function handleCommentAccessError(err: unknown, res: Response): boolean {
  const message = err instanceof Error ? err.message : '';
  if (message === 'post_not_found') {
    res.status(404).json({ error: 'Post not found' });
    return true;
  }
  if (message === 'invalid_body') {
    res.status(400).json({ error: 'Comment must be 1–280 characters' });
    return true;
  }
  return false;
}

/**
 * GET /api/community/mention-suggestions?q=&limit=
 * Autocomplete suggestions for @ mentions in Community posts and comments.
 * Limited strictly to:
 * 1. Live public Hot Spots (commercial venues + ops-curated outdoor)
 * 2. Mutual matches of the viewer
 * Never strangers, never un-matched nearby users.
 */
router.get('/mention-suggestions', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = CommunityMentionSuggestionsQuerySchema.parse({
      q: req.query.q != null ? String(req.query.q) : '',
      limit: req.query.limit != null ? req.query.limit : 10,
    });
    const suggestions = await communityService.getMentionSuggestions(
      req.userId!,
      parsed.q,
      parsed.limit,
    );
    res.json({ suggestions });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid mention query parameters' });
    }
    console.error('[community] mention-suggestions', err);
    res.status(500).json({ error: 'Could not load mention suggestions' });
  }
});

/**
 * GET /api/community/posts/:id/comments
 * Text comments on a Community post. Free for all verified members.
 */
router.get('/posts/:id/comments', async (req: AuthRequest, res: Response) => {
  try {
    const postId = PostIdParam.parse(req.params.id);
    const comments = await communityService.listComments(req.userId!, postId);
    res.json({ comments });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid post' });
    }
    if (handleCommentAccessError(err, res)) return;
    console.error('[community] list comments', err);
    res.status(400).json({ error: 'Could not load comments' });
  }
});

/**
 * POST /api/community/posts/:id/comments { body }
 * Reply on a Community post (≤280). Free — no premium check.
 */
router.post('/posts/:id/comments', commentLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const postId = PostIdParam.parse(req.params.id);
    const parsed = CommunityCreateCommentSchema.parse(req.body ?? {});
    const comment = await communityService.createComment(req.userId!, postId, parsed.body);
    res.status(201).json({ comment });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Comment must be 1–280 characters' });
    }
    if (handleCommentAccessError(err, res)) return;
    console.error('[community] create comment', err);
    res.status(500).json({ error: 'Could not add comment' });
  }
});

const CommentIdParam = z.string().uuid();

/**
 * PUT /api/community/posts/:id/comments/:commentId { body }
 * Update author's own comment (≤280).
 */
router.put('/posts/:id/comments/:commentId', commentLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const postId = PostIdParam.parse(req.params.id);
    const commentId = CommentIdParam.parse(req.params.commentId);
    const parsed = CommunityUpdateCommentSchema.parse(req.body ?? {});
    const comment = await communityService.updateComment(req.userId!, postId, commentId, parsed.body);
    res.json({ comment });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Comment must be 1–280 characters' });
    }
    const message = err instanceof Error ? err.message : '';
    if (message === 'post_not_found') {
      return res.status(404).json({ error: 'Post not found' });
    }
    if (message === 'comment_not_found') {
      return res.status(404).json({ error: 'Comment not found' });
    }
    if (message === 'forbidden') {
      return res.status(403).json({ error: 'You can only edit your own comments' });
    }
    if (message === 'invalid_body') {
      return res.status(400).json({ error: 'Comment must be 1–280 characters' });
    }
    console.error('[community] update comment', err);
    res.status(500).json({ error: 'Could not update comment' });
  }
});

/**
 * DELETE /api/community/posts/:id/comments/:commentId
 * Delete author's own comment.
 */
router.delete('/posts/:id/comments/:commentId', async (req: AuthRequest, res: Response) => {
  try {
    const postId = PostIdParam.parse(req.params.id);
    const commentId = CommentIdParam.parse(req.params.commentId);
    await communityService.deleteComment(req.userId!, postId, commentId);
    res.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request' });
    }
    const message = err instanceof Error ? err.message : '';
    if (message === 'comment_not_found') {
      return res.status(404).json({ error: 'Comment not found' });
    }
    if (message === 'forbidden') {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }
    console.error('[community] delete comment', err);
    res.status(500).json({ error: 'Could not delete comment' });
  }
});

export default router;
