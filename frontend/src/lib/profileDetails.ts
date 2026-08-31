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

export function profileCompletionScore(p: ProfileCompletionInput): {
  score: number;
  total: number;
  missing: string[];
} {
  const hasRealPhoto = Boolean(
    p.photo_url &&
      !String(p.photo_url).includes('generic') &&
      !String(p.photo_url).includes('/avatars/'),
  );
  const checks: Array<{ label: string; ok: boolean }> = [
    { label: 'Display name', ok: Boolean(p.name && p.name.trim().length >= 2) },
    { label: 'Date of birth', ok: Boolean(p.date_of_birth) || (typeof p.age === 'number' && p.age >= 18) },
    { label: 'Real photo', ok: hasRealPhoto },
    { label: 'Bio', ok: Boolean(p.bio && p.bio.trim().length >= 20) },
    { label: 'Headline', ok: Boolean(p.headline && p.headline.trim().length > 0) },
    { label: 'Looking for', ok: Boolean(p.looking_for && p.looking_for.trim().length > 0) },
    { label: 'Tags', ok: Boolean(p.interests && p.interests.length >= 3) },
    { label: 'Height', ok: p.height_cm != null },
    { label: 'Body / vibe tags', ok: Boolean(p.interests && p.interests.length >= 5) },
    { label: 'Relationship status', ok: Boolean(p.relationship_status) },
    { label: 'Hosting', ok: Boolean(p.hosting_status) },
  ];

  const missing = checks.filter((c) => !c.ok).map((c) => c.label);
  return { score: checks.length - missing.length, total: checks.length, missing };
}
