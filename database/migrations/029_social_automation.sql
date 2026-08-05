-- ─────────────────────────────────────────────────────────────────────────────
-- 029_social_automation.sql
-- Social media automation foundation: reusable post templates, a
-- cross-platform content calendar with a mandatory human-approval gate,
-- and lightweight engagement tracking.
--
-- Nothing in this schema or the services built on it ever auto-publishes.
-- "published" is always set by an explicit, human-triggered API call that
-- records something a person already did outside this system. See
-- docs/AI_TEAM.md rule 11.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS social_post_templates (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT        NOT NULL UNIQUE,        -- e.g. 'waitlist-countdown'
  name              TEXT        NOT NULL,
  category          TEXT        NOT NULL DEFAULT 'general', -- e.g. 'waitlist','party','brand'
  platforms         TEXT[]      NOT NULL DEFAULT '{}',  -- intended platforms, informational only
  body_template     TEXT        NOT NULL,               -- raw copy with {{variable}} placeholders
  variables         JSONB       NOT NULL DEFAULT '[]',  -- [{"key","label","default"}]
  default_hashtags  TEXT[]      NOT NULL DEFAULT '{}',
  media_note        TEXT,                               -- e.g. "rooftop-dusk image; never alter the logo"
  created_by        TEXT        NOT NULL DEFAULT 'system',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at       TIMESTAMPTZ                          -- soft delete; NULL = active
);

CREATE INDEX IF NOT EXISTS idx_social_post_templates_category
  ON social_post_templates(category) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS social_posts (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id        UUID        REFERENCES social_post_templates(id) ON DELETE SET NULL,
  platform           TEXT        NOT NULL
    CHECK (platform IN ('x', 'instagram', 'tiktok', 'bluesky', 'reddit')),
  status             TEXT        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'scheduled', 'published', 'rejected')),
  campaign           TEXT,                                -- freeform label, e.g. 'launch-countdown' (not FK — see note below)
  variables          JSONB       NOT NULL DEFAULT '{}',    -- resolved values used to render body
  rendered_body      TEXT        NOT NULL,                 -- final caption after variable substitution
  hashtags           TEXT[]      NOT NULL DEFAULT '{}',
  media_urls         TEXT[]      NOT NULL DEFAULT '{}',    -- references to already-approved assets only
  link_url           TEXT,                                 -- tracked link, should carry utm_* params
  scheduled_for      TIMESTAMPTZ,                          -- intended publish slot (operator-picked)
  approved_by        TEXT,
  approved_at        TIMESTAMPTZ,
  rejected_reason    TEXT,
  published_at       TIMESTAMPTZ,
  published_via      TEXT        CHECK (published_via IS NULL OR published_via IN ('manual', 'buffer')),
  external_post_id   TEXT,                                 -- e.g. Buffer post id or a pasted-in platform URL
  engagement_stats   JSONB       NOT NULL DEFAULT '{}',    -- manually-recorded {impressions, likes, shares, clicks, ...}
  stats_updated_at   TIMESTAMPTZ,
  created_by         TEXT        NOT NULL DEFAULT 'system',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Approval queue / calendar views
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_platform_status ON social_posts(platform, status);
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled_for ON social_posts(scheduled_for)
  WHERE status IN ('approved', 'scheduled');
CREATE INDEX IF NOT EXISTS idx_social_posts_campaign ON social_posts(campaign) WHERE campaign IS NOT NULL;

-- Note: `campaign` is a plain label, deliberately not a foreign key into
-- promo_codes/promo campaigns — promo-code economics (months free, prefix,
-- expiry) and content-calendar grouping are different concepts.
