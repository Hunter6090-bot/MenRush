import { query } from '../db';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const SOCIAL_PLATFORMS = ['x', 'instagram', 'tiktok', 'bluesky', 'reddit'] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_POST_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'scheduled',
  'published',
  'rejected',
] as const;
export type SocialPostStatus = (typeof SOCIAL_POST_STATUSES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Template rendering
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simple {{key}} substitution. Unresolved placeholders are left as-is —
 * callers (the route layer) are responsible for validating that all
 * required variables were supplied before rendering.
 */
export function renderTemplate(bodyTemplate: string, variables: Record<string, string>): string {
  return bodyTemplate.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TemplateVariable {
  key: string;
  label?: string;
  default?: string;
}

export interface SocialPostTemplate {
  id: string;
  slug: string;
  name: string;
  category: string;
  platforms: SocialPlatform[];
  bodyTemplate: string;
  variables: TemplateVariable[];
  defaultHashtags: string[];
  mediaNote: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

export interface SocialPost {
  id: string;
  templateId: string | null;
  platform: SocialPlatform;
  status: SocialPostStatus;
  campaign: string | null;
  variables: Record<string, string>;
  renderedBody: string;
  hashtags: string[];
  mediaUrls: string[];
  linkUrl: string | null;
  scheduledFor: Date | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectedReason: string | null;
  publishedAt: Date | null;
  publishedVia: 'manual' | 'buffer' | null;
  externalPostId: string | null;
  engagementStats: Record<string, number>;
  statsUpdatedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Row mappers
// ─────────────────────────────────────────────────────────────────────────────

type TemplateRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  platforms: SocialPlatform[];
  body_template: string;
  variables: TemplateVariable[];
  default_hashtags: string[];
  media_note: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  archived_at: Date | null;
};

function mapTemplate(row: TemplateRow): SocialPostTemplate {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    platforms: row.platforms,
    bodyTemplate: row.body_template,
    variables: row.variables,
    defaultHashtags: row.default_hashtags,
    mediaNote: row.media_note,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

type PostRow = {
  id: string;
  template_id: string | null;
  platform: SocialPlatform;
  status: SocialPostStatus;
  campaign: string | null;
  variables: Record<string, string>;
  rendered_body: string;
  hashtags: string[];
  media_urls: string[];
  link_url: string | null;
  scheduled_for: Date | null;
  approved_by: string | null;
  approved_at: Date | null;
  rejected_reason: string | null;
  published_at: Date | null;
  published_via: 'manual' | 'buffer' | null;
  external_post_id: string | null;
  engagement_stats: Record<string, number>;
  stats_updated_at: Date | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
};

function mapPost(row: PostRow): SocialPost {
  return {
    id: row.id,
    templateId: row.template_id,
    platform: row.platform,
    status: row.status,
    campaign: row.campaign,
    variables: row.variables,
    renderedBody: row.rendered_body,
    hashtags: row.hashtags,
    mediaUrls: row.media_urls,
    linkUrl: row.link_url,
    scheduledFor: row.scheduled_for,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    rejectedReason: row.rejected_reason,
    publishedAt: row.published_at,
    publishedVia: row.published_via,
    externalPostId: row.external_post_id,
    engagementStats: row.engagement_stats,
    statsUpdatedAt: row.stats_updated_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
//
// No function in this file makes an outbound call to any social platform or
// to Buffer. `markPublished` only ever records that a human already posted
// something elsewhere. See docs/AI_TEAM.md rule 11 — nothing here auto-publishes.
// ─────────────────────────────────────────────────────────────────────────────

export const socialService = {
  // ── Templates ────────────────────────────────────────────────────────────

  async createTemplate(input: {
    slug: string;
    name: string;
    category?: string;
    platforms?: SocialPlatform[];
    bodyTemplate: string;
    variables?: TemplateVariable[];
    defaultHashtags?: string[];
    mediaNote?: string;
    createdBy: string;
  }): Promise<SocialPostTemplate> {
    const result = await query(
      `INSERT INTO social_post_templates
         (slug, name, category, platforms, body_template, variables, default_hashtags, media_note, created_by)
       VALUES ($1, $2, COALESCE($3, 'general'), COALESCE($4, '{}'), $5, COALESCE($6, '[]'), COALESCE($7, '{}'), $8, $9)
       RETURNING *`,
      [
        input.slug,
        input.name,
        input.category ?? null,
        input.platforms ?? null,
        input.bodyTemplate,
        input.variables ? JSON.stringify(input.variables) : null,
        input.defaultHashtags ?? null,
        input.mediaNote ?? null,
        input.createdBy,
      ],
    );
    return mapTemplate(result.rows[0] as TemplateRow);
  },

  async listTemplates(filters?: { category?: string; includeArchived?: boolean }): Promise<SocialPostTemplate[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (!filters?.includeArchived) {
      conditions.push('archived_at IS NULL');
    }
    if (filters?.category) {
      params.push(filters.category);
      conditions.push(`category = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(
      `SELECT * FROM social_post_templates ${where} ORDER BY created_at DESC`,
      params,
    );
    return (result.rows as TemplateRow[]).map(mapTemplate);
  },

  async getTemplate(id: string): Promise<SocialPostTemplate | null> {
    const result = await query('SELECT * FROM social_post_templates WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return mapTemplate(result.rows[0] as TemplateRow);
  },

  async archiveTemplate(id: string): Promise<void> {
    await query(
      'UPDATE social_post_templates SET archived_at = NOW(), updated_at = NOW() WHERE id = $1 AND archived_at IS NULL',
      [id],
    );
  },

  // ── Posts ────────────────────────────────────────────────────────────────

  async createPost(input: {
    templateId?: string;
    platform: SocialPlatform;
    variables?: Record<string, string>;
    renderedBody?: string;
    campaign?: string;
    hashtags?: string[];
    mediaUrls?: string[];
    linkUrl?: string;
    scheduledFor?: Date;
    createdBy: string;
  }): Promise<SocialPost> {
    let renderedBody = input.renderedBody;
    let hashtags = input.hashtags ?? [];

    if (input.templateId) {
      const template = await socialService.getTemplate(input.templateId);
      if (!template || template.archivedAt) {
        throw new Error(`Unknown template: ${input.templateId}`);
      }
      renderedBody = renderTemplate(template.bodyTemplate, input.variables ?? {});
      if (!input.hashtags) hashtags = template.defaultHashtags;
    }

    if (!renderedBody) {
      throw new Error('Cannot create post: renderedBody is required when templateId is not supplied');
    }

    const result = await query(
      `INSERT INTO social_posts
         (template_id, platform, campaign, variables, rendered_body, hashtags, media_urls, link_url, scheduled_for, created_by)
       VALUES ($1, $2, $3, COALESCE($4, '{}'), $5, COALESCE($6, '{}'), COALESCE($7, '{}'), $8, $9, $10)
       RETURNING *`,
      [
        input.templateId ?? null,
        input.platform,
        input.campaign ?? null,
        input.variables ? JSON.stringify(input.variables) : null,
        renderedBody,
        hashtags,
        input.mediaUrls ?? null,
        input.linkUrl ?? null,
        input.scheduledFor ?? null,
        input.createdBy,
      ],
    );
    return mapPost(result.rows[0] as PostRow);
  },

  async listPosts(filters?: {
    status?: SocialPostStatus;
    platform?: SocialPlatform;
    campaign?: string;
  }): Promise<SocialPost[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.status) {
      params.push(filters.status);
      conditions.push(`status = $${params.length}`);
    }
    if (filters?.platform) {
      params.push(filters.platform);
      conditions.push(`platform = $${params.length}`);
    }
    if (filters?.campaign) {
      params.push(filters.campaign);
      conditions.push(`campaign = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(
      `SELECT * FROM social_posts ${where} ORDER BY COALESCE(scheduled_for, created_at) ASC`,
      params,
    );
    return (result.rows as PostRow[]).map(mapPost);
  },

  async getPost(id: string): Promise<SocialPost | null> {
    const result = await query('SELECT * FROM social_posts WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return mapPost(result.rows[0] as PostRow);
  },

  /** Guard every state transition against a re-fetch so failures report the real current status. */
  async _requireCurrentStatus(id: string): Promise<SocialPost> {
    const post = await socialService.getPost(id);
    if (!post) throw new Error(`Unknown post: ${id}`);
    return post;
  },

  async submitForApproval(id: string): Promise<SocialPost> {
    const result = await query(
      `UPDATE social_posts SET status = 'pending_approval', updated_at = NOW()
       WHERE id = $1 AND status = 'draft' RETURNING *`,
      [id],
    );
    if (result.rows.length === 0) {
      const current = await socialService._requireCurrentStatus(id);
      throw new Error(`Cannot submit for approval: post is currently '${current.status}'`);
    }
    return mapPost(result.rows[0] as PostRow);
  },

  async approve(id: string, approvedBy: string, scheduledFor?: Date): Promise<SocialPost> {
    const nextStatus = scheduledFor ? 'scheduled' : 'approved';
    const result = await query(
      `UPDATE social_posts
       SET status = $2,
           approved_by = $3,
           approved_at = NOW(),
           scheduled_for = COALESCE($4, scheduled_for),
           updated_at = NOW()
       WHERE id = $1 AND status = 'pending_approval'
       RETURNING *`,
      [id, nextStatus, approvedBy, scheduledFor ?? null],
    );
    if (result.rows.length === 0) {
      const current = await socialService._requireCurrentStatus(id);
      throw new Error(`Cannot approve: post is currently '${current.status}'`);
    }
    return mapPost(result.rows[0] as PostRow);
  },

  async reject(id: string, reason: string): Promise<SocialPost> {
    const result = await query(
      `UPDATE social_posts SET status = 'rejected', rejected_reason = $2, updated_at = NOW()
       WHERE id = $1 AND status = 'pending_approval' RETURNING *`,
      [id, reason],
    );
    if (result.rows.length === 0) {
      const current = await socialService._requireCurrentStatus(id);
      throw new Error(`Cannot reject: post is currently '${current.status}'`);
    }
    return mapPost(result.rows[0] as PostRow);
  },

  /**
   * Record that a human already published this post somewhere. This never
   * calls any platform or Buffer API — it is purely a record-keeping step
   * triggered by a person after the fact.
   */
  async markPublished(
    id: string,
    input: { publishedVia: 'manual' | 'buffer'; externalPostId?: string; publishedAt?: Date },
  ): Promise<SocialPost> {
    const result = await query(
      `UPDATE social_posts
       SET status = 'published',
           published_via = $2,
           external_post_id = $3,
           published_at = COALESCE($4, NOW()),
           updated_at = NOW()
       WHERE id = $1 AND status IN ('approved', 'scheduled')
       RETURNING *`,
      [id, input.publishedVia, input.externalPostId ?? null, input.publishedAt ?? null],
    );
    if (result.rows.length === 0) {
      const current = await socialService._requireCurrentStatus(id);
      throw new Error(`Cannot mark published: post is currently '${current.status}'`);
    }
    return mapPost(result.rows[0] as PostRow);
  },

  async recordEngagement(id: string, stats: Record<string, number>): Promise<SocialPost> {
    const result = await query(
      `UPDATE social_posts
       SET engagement_stats = engagement_stats || $2::jsonb,
           stats_updated_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, JSON.stringify(stats)],
    );
    if (result.rows.length === 0) {
      throw new Error(`Unknown post: ${id}`);
    }
    return mapPost(result.rows[0] as PostRow);
  },

  async stats(filters?: { campaign?: string; platform?: SocialPlatform }): Promise<{
    total: number;
    byStatus: Record<SocialPostStatus, number>;
  }> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.campaign) {
      params.push(filters.campaign);
      conditions.push(`campaign = $${params.length}`);
    }
    if (filters?.platform) {
      params.push(filters.platform);
      conditions.push(`platform = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT status, COUNT(*) AS count FROM social_posts ${where} GROUP BY status`,
      params,
    );

    const byStatus = SOCIAL_POST_STATUSES.reduce(
      (acc, status) => ({ ...acc, [status]: 0 }),
      {} as Record<SocialPostStatus, number>,
    );
    let total = 0;
    for (const row of result.rows as Array<{ status: SocialPostStatus; count: string }>) {
      const count = parseInt(row.count, 10);
      byStatus[row.status] = count;
      total += count;
    }

    return { total, byStatus };
  },
};
