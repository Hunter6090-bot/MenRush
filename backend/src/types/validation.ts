import { z } from 'zod';

const normalizedEmail = z
  .string()
  .email()
  .transform((email) => email.trim().toLowerCase());

const isoDateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

export const RELATIONSHIP_STATUSES = [
  'Single',
  'Taken',
  'Open',
  'Complicated',
  'Prefer not to say',
] as const;

export const HOSTING_STATUSES = [
  'Hosting',
  'Travelling',
  'Public only',
  'Depends',
] as const;

export const SEXUAL_HEALTH_STATUSES = [
  'Negative',
  'Positive',
  'Undetectable',
  'Prefer not to say',
] as const;

export const RegisterSchema = z.object({
  email: normalizedEmail,
  password: z.string().min(8),
  name: z.string().min(2).max(50),
  age: z.number().min(18).max(120),
  /** Preferred source of truth for age — persisted and used to recompute age. */
  date_of_birth: isoDateOnly.optional(),
  invite_code: z.string().min(1).max(64).optional(),
  /** Optional public promo (e.g. Pride QR). Validated at register. */
  promo_code: z.string().min(1).max(64).optional(),
  /** Optional friend referral — not an invite gate; fail closed if invalid. */
  referral_code: z.string().min(1).max(32).optional(),
});

export const LoginSchema = z.object({
  email: normalizedEmail,
  password: z.string(),
  /** Opaque trusted-device token from a prior "Trust this device" login. */
  deviceTrustToken: z.string().min(32).max(128).optional(),
});

export const ForgotPasswordSchema = z.object({
  email: normalizedEmail,
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export const ChangePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: z.string().min(8, 'New password must be at least 8 characters'),
  })
  .refine((data) => data.current_password !== data.new_password, {
    message: 'New password must be different from your current password',
    path: ['new_password'],
  });

export const ChangeEmailSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_email: normalizedEmail,
});

export const TwoFactorCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app'),
});

export const TwoFactorVerifyLoginSchema = z.object({
  pendingToken: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app'),
  trustThisDevice: z.boolean().optional(),
});

export const ProfileSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  date_of_birth: isoDateOnly.nullable().optional(),
  bio: z.string().max(500).optional(),
  headline: z.string().max(100).optional(),
  looking_for: z.string().max(100).optional(),
  photo_url: z.string().optional(),
  cover_url: z.string().optional(),
  cover_position_x: z.number().min(0).max(100).optional(),
  cover_position_y: z.number().min(0).max(100).optional(),
  cover_zoom: z.number().min(1).max(3).optional(),
  interests: z.array(z.string().max(30)).max(20).optional(),
  height_cm: z.number().int().min(120).max(250).nullable().optional(),
  weight_kg: z.number().int().min(35).max(300).nullable().optional(),
  relationship_status: z.enum(RELATIONSHIP_STATUSES).nullable().optional(),
  hosting_status: z.enum(HOSTING_STATUSES).nullable().optional(),
  sexual_health_status: z.enum(SEXUAL_HEALTH_STATUSES).nullable().optional(),
  on_prep: z.boolean().nullable().optional(),
  last_tested_at: isoDateOnly.nullable().optional(),
  show_age: z.boolean().optional(),
});

export const DeleteAccountSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  confirmation: z.literal('DELETE'),
});

export const LocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** Community Space — short local text only (≤280). No media. */
export const CommunityCreatePostSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Post cannot be empty')
    .max(280, 'Post must be 280 characters or fewer'),
});

/** Comment on a Community post — same text-only 280 cap. Free for all. */
export const CommunityCreateCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Comment cannot be empty')
    .max(280, 'Comment must be 280 characters or fewer'),
});

export const MessageSchema = z.object({
  receiver_id: z.string().uuid(),
  message: z.string().min(1).max(1000),
});

// Media messages (image or audio) accept the same receiver + an optional
// caption. The file is uploaded as multipart and validated server-side.
export const LocationMessageSchema = z.object({
  receiver_id: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const MEDIA_KINDS = ['image', 'audio', 'video'] as const;
export const MESSAGE_MEDIA_KINDS = ['image', 'audio', 'video', 'location'] as const;
export const MediaMessageFormSchema = z.object({
  receiver_id: z.string().uuid(),
  kind: z.enum(MEDIA_KINDS),
  /** Optional caption when sending an image/video. Ignored for audio. */
  caption: z.string().max(500).optional(),
  /** Whether the image is disappearing (view-limited) vs. kept permanently. */
  disappearing: z
    .preprocess((val) => {
      if (val === undefined || val === null || val === '') return undefined;
      if (typeof val === 'boolean') return val;
      if (val === 'true' || val === '1') return true;
      if (val === 'false' || val === '0') return false;
      return val;
    }, z.boolean().optional()),
  /**
   * For disappearing images: how many times the recipient may view it.
   * 1 = view once, 2 = view twice, N = limited views. Ignored (NULL) when
   * the image is permanent. Capped to keep "disappearing" meaningful.
   */
  max_views: z.coerce.number().int().min(1).max(99).optional(),
  /** Duration in ms — required for audio/video kinds. */
  duration_ms: z.coerce.number().int().min(0).max(180_000).optional(),
});

/**
 * Send an existing My Photos library photo into a 1:1 chat.
 * Copies bytes into message storage — never deletes, moves, or changes
 * album visibility / album_photos rows.
 */
export const AlbumMediaMessageSchema = z.object({
  receiver_id: z.string().uuid(),
  photo_id: z.string().uuid(),
  caption: z.string().max(500).optional(),
  disappearing: z
    .preprocess((val) => {
      if (val === undefined || val === null || val === '') return undefined;
      if (typeof val === 'boolean') return val;
      if (val === 'true' || val === '1') return true;
      if (val === 'false' || val === '0') return false;
      return val;
    }, z.boolean().optional()),
  max_views: z.coerce.number().int().min(1).max(99).optional(),
});

export const CreateRoomSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  avatar_url: z.string().url().optional(),
  is_location_based: z.boolean().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  max_members: z.number().int().min(2).max(1000).optional(),
  /** Premium invite-only groups: add these members after create (owner stays owner). */
  member_ids: z.array(z.string().uuid()).max(49).optional(),
});

export const RoomMessageSchema = z.object({
  message: z.string().min(1).max(2000),
  reply_to: z.string().uuid().optional(),
});

export const AddRoomMemberSchema = z.object({
  user_id: z.string().uuid(),
});

/**
 * Temporary identity for a specific room — never written to main profile.
 * Gate offers profile OR temp; when temp is chosen, display_name is required
 * and photo is optional (letter avatar when omitted).
 */
export const RoomTempIdentitySchema = z.object({
  display_name: z.string().trim().min(1).max(40),
  /** Optional temp photo — never falls back to profile face on the temp path. */
  photo_url: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  save_name: z.boolean().optional(),
  save_photo: z.boolean().optional(),
});

export const ContactFormSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  email: z.string().trim().email('Enter a valid email address'),
  enquiryType: z.enum(['general', 'privacy', 'support', 'press']),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(8000),
});

export const MOOD_VALUES = [
  'roaming',
  'looking',
  'down_to_chat',
  'dont_talk_just_watch',
  'at_a_bar',
  'hosting',
  'travelling',
] as const;

export const MoodSchema = z.object({
  mood: z.enum(MOOD_VALUES).nullable(),
});

export const GhostSchema = z.object({
  is_ghost: z.boolean(),
});

export const LiveLocationSharingSchema = z.object({
  enabled: z.boolean(),
});

export const PHOTO_VISIBILITIES = ['public', 'view_once', 'private'] as const;

export const CreateAlbumSchema = z.object({
  name: z.string().trim().min(1, 'Album name is required').max(80),
  description: z.string().trim().max(500).optional(),
  is_locked: z.boolean().optional(),
});

export const AddAlbumPhotoSchema = z.object({
  photo_url: z.string().min(1, 'Photo URL is required'),
});

export const GrantAlbumSchema = z.object({
  viewer_id: z.string().uuid('Invalid viewer id'),
});

export const PhotoVisibilitySchema = z.enum(PHOTO_VISIBILITIES);

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type ChangeEmailInput = z.infer<typeof ChangeEmailSchema>;
export type ProfileInput = z.infer<typeof ProfileSchema>;
export type DeleteAccountInput = z.infer<typeof DeleteAccountSchema>;
export type LocationInput = z.infer<typeof LocationSchema>;
export type CommunityCreatePostInput = z.infer<typeof CommunityCreatePostSchema>;
export type CommunityCreateCommentInput = z.infer<typeof CommunityCreateCommentSchema>;
export type MessageInput = z.infer<typeof MessageSchema>;
export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;
export type RoomMessageInput = z.infer<typeof RoomMessageSchema>;
export type RoomTempIdentityInput = z.infer<typeof RoomTempIdentitySchema>;
export type ContactFormInput = z.infer<typeof ContactFormSchema>;
export type Mood = (typeof MOOD_VALUES)[number];
export type MoodInput = z.infer<typeof MoodSchema>;
export type GhostInput = z.infer<typeof GhostSchema>;
export type CreateAlbumInput = z.infer<typeof CreateAlbumSchema>;
export type AddAlbumPhotoInput = z.infer<typeof AddAlbumPhotoSchema>;
export type GrantAlbumInput = z.infer<typeof GrantAlbumSchema>;
export type PhotoVisibility = z.infer<typeof PhotoVisibilitySchema>;
export type MediaKind = (typeof MEDIA_KINDS)[number];
export type MessageMediaKind = (typeof MESSAGE_MEDIA_KINDS)[number];
export type LocationMessageInput = z.infer<typeof LocationMessageSchema>;
export type MediaMessageFormInput = z.infer<typeof MediaMessageFormSchema>;
export type AlbumMediaMessageInput = z.infer<typeof AlbumMediaMessageSchema>;
