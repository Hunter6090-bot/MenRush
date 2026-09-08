/** Structured profile options — aligned with backend CHECK constraints. */

export const RELATIONSHIP_STATUS_OPTIONS = [
  'Single',
  'Taken',
  'Open',
  'Complicated',
  'Prefer not to say',
] as const;

export const HOSTING_STATUS_OPTIONS = [
  'Hosting',
  'Travelling',
  'Public only',
  'Depends',
] as const;

export const SEXUAL_HEALTH_STATUS_OPTIONS = [
  'Negative',
  'Positive',
  'Undetectable',
  'Prefer not to say',
] as const;

export type RelationshipStatus = (typeof RELATIONSHIP_STATUS_OPTIONS)[number];
export type HostingStatus = (typeof HOSTING_STATUS_OPTIONS)[number];
export type SexualHealthStatus = (typeof SEXUAL_HEALTH_STATUS_OPTIONS)[number];

export const PROFILE_INTERESTS_MAX = 20;

/** Stable ids for Settings chips ↔ Profile section anchors. */
export type ProfileEssentialId =
  | 'display_name'
  | 'date_of_birth'
  | 'real_photo'
  | 'bio'
  | 'headline'
  | 'looking_for'
  | 'tags'
  | 'height'
  | 'body_vibe_tags'
  | 'relationship_status'
  | 'hosting';

/** DOM ids on /profile edit form. Shared by Settings deep-links. */
export const PROFILE_ESSENTIAL_SECTION_IDS: Record<ProfileEssentialId, string> = {
  display_name: 'profile-essential-name',
  date_of_birth: 'profile-essential-dob',
  real_photo: 'profile-essential-photo',
  bio: 'profile-essential-bio',
  headline: 'profile-essential-headline',
  looking_for: 'profile-essential-looking',
  tags: 'profile-essential-tags',
  height: 'profile-essential-height',
  body_vibe_tags: 'profile-essential-tags',
  relationship_status: 'profile-essential-relationship',
  hosting: 'profile-essential-hosting',
};

export interface ProfileEssentialItem {
  id: ProfileEssentialId;
  label: string;
  sectionId: string;
}

export interface ProfileCompletionInput {
  name?: string | null;
  date_of_birth?: string | null;
  age?: number | null;
  bio?: string | null;
  headline?: string | null;
  looking_for?: string | null;
  photo_url?: string | null;
  interests?: string[] | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  relationship_status?: string | null;
  hosting_status?: string | null;
  sexual_health_status?: string | null;
  on_prep?: boolean | null;
  last_tested_at?: string | null;
}

function hasRealPhoto(photoUrl?: string | null): boolean {
  return Boolean(
    photoUrl &&
      !String(photoUrl).includes('generic') &&
      !String(photoUrl).includes('/avatars/'),
  );
}

/** Live essentials checklist. Do not invent extra required fields. */
export function profileEssentialChecks(p: ProfileCompletionInput): Array<ProfileEssentialItem & { ok: boolean }> {
  return [
    {
      id: 'display_name',
      label: 'Display name',
      sectionId: PROFILE_ESSENTIAL_SECTION_IDS.display_name,
      ok: Boolean(p.name && p.name.trim().length >= 2),
    },
    {
      id: 'date_of_birth',
      label: 'Date of birth',
      sectionId: PROFILE_ESSENTIAL_SECTION_IDS.date_of_birth,
      ok: Boolean(p.date_of_birth) || (typeof p.age === 'number' && p.age >= 18),
    },
    {
      id: 'real_photo',
      label: 'Real photo',
      sectionId: PROFILE_ESSENTIAL_SECTION_IDS.real_photo,
      ok: hasRealPhoto(p.photo_url),
    },
    {
      id: 'bio',
      label: 'Bio',
      sectionId: PROFILE_ESSENTIAL_SECTION_IDS.bio,
      ok: Boolean(p.bio && p.bio.trim().length >= 20),
    },
    {
      id: 'headline',
      label: 'Headline',
      sectionId: PROFILE_ESSENTIAL_SECTION_IDS.headline,
      ok: Boolean(p.headline && p.headline.trim().length > 0),
    },
    {
      id: 'looking_for',
      label: 'Looking for',
      sectionId: PROFILE_ESSENTIAL_SECTION_IDS.looking_for,
      ok: Boolean(p.looking_for && p.looking_for.trim().length > 0),
    },
    {
      id: 'tags',
      label: 'Tags',
      sectionId: PROFILE_ESSENTIAL_SECTION_IDS.tags,
      ok: Boolean(p.interests && p.interests.length >= 3),
    },
    {
      id: 'height',
      label: 'Height',
      sectionId: PROFILE_ESSENTIAL_SECTION_IDS.height,
      ok: p.height_cm != null,
    },
    {
      id: 'body_vibe_tags',
      label: 'Body / vibe tags',
      sectionId: PROFILE_ESSENTIAL_SECTION_IDS.body_vibe_tags,
      ok: Boolean(p.interests && p.interests.length >= 5),
    },
    {
      id: 'relationship_status',
      label: 'Relationship status',
      sectionId: PROFILE_ESSENTIAL_SECTION_IDS.relationship_status,
      ok: Boolean(p.relationship_status),
    },
    {
      id: 'hosting',
      label: 'Hosting',
      sectionId: PROFILE_ESSENTIAL_SECTION_IDS.hosting,
      ok: Boolean(p.hosting_status),
    },
  ];
}

export function profileCompletionScore(p: ProfileCompletionInput): {
  score: number;
  total: number;
  missing: string[];
  missingItems: ProfileEssentialItem[];
} {
  const checks = profileEssentialChecks(p);
  const missingItems = checks
    .filter((c) => !c.ok)
    .map(({ id, label, sectionId }) => ({ id, label, sectionId }));
  return {
    score: checks.length - missingItems.length,
    total: checks.length,
    missing: missingItems.map((m) => m.label),
    missingItems,
  };
}

/** First incomplete section id, or null when complete. */
export function firstMissingEssentialSectionId(p: ProfileCompletionInput): string | null {
  return profileCompletionScore(p).missingItems[0]?.sectionId ?? null;
}

/**
 * Scroll to a Profile essential section and focus its primary control.
 * Used by Still missing chips and the sticky named incomplete cue.
 */
export function jumpToProfileEssential(sectionId: string): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.getElementById(sectionId);
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  window.setTimeout(() => {
    const focusable = el.querySelector<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus({ preventScroll: true });
  }, 280);
  return true;
}
