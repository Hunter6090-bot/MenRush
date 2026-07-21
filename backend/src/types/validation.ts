import { z } from 'zod';

const normalizedEmail = z
  .string()
  .email()
  .transform((email) => email.trim().toLowerCase());

export const RegisterSchema = z.object({
  email: normalizedEmail,
  password: z.string().min(8),
  name: z.string().min(2).max(50),
  age: z.number().min(18).max(120),
  invite_code: z.string().min(1).max(64).optional(),
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
  bio: z.string().max(500).optional(),
  headline: z.string().max(100).optional(),
  looking_for: z.string().max(100).optional(),
  photo_url: z.string().optional(),
  cover_url: z.string().optional(),
  cover_position_x: z.number().min(0).max(100).optional(),
  cover_position_y: z.number().min(0).max(100).optional(),
  cover_zoom: z.number().min(1).max(3).optional(),
  interests: z.array(z.string().max(30)).max(10).optional(),
});

export const LocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
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

export const CreateRoomSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  avatar_url: z.string().url().optional(),
  is_location_based: z.boolean().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  max_members: z.number().int().min(2).max(1000).optional(),
});

export const RoomMessageSchema = z.object({
  message: z.string().min(1).max(2000),
  reply_to: z.string().uuid().optional(),
});

export const AddRoomMemberSchema = z.object({
  user_id: z.string().uuid(),
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

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type ChangeEmailInput = z.infer<typeof ChangeEmailSchema>;
export type ProfileInput = z.infer<typeof ProfileSchema>;
export type LocationInput = z.infer<typeof LocationSchema>;
export type MessageInput = z.infer<typeof MessageSchema>;
export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;
export type RoomMessageInput = z.infer<typeof RoomMessageSchema>;
export type ContactFormInput = z.infer<typeof ContactFormSchema>;
export type Mood = (typeof MOOD_VALUES)[number];
export type MoodInput = z.infer<typeof MoodSchema>;
export type GhostInput = z.infer<typeof GhostSchema>;
export type CreateAlbumInput = z.infer<typeof CreateAlbumSchema>;
export type AddAlbumPhotoInput = z.infer<typeof AddAlbumPhotoSchema>;
export type GrantAlbumInput = z.infer<typeof GrantAlbumSchema>;
export type MediaKind = (typeof MEDIA_KINDS)[number];
export type MessageMediaKind = (typeof MESSAGE_MEDIA_KINDS)[number];
export type LocationMessageInput = z.infer<typeof LocationMessageSchema>;
export type MediaMessageFormInput = z.infer<typeof MediaMessageFormSchema>;
