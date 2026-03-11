import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(50),
  age: z.number().min(18).max(120),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const ProfileSchema = z.object({
  bio: z.string().max(500).optional(),
  headline: z.string().max(100).optional(),
  looking_for: z.string().max(100).optional(),
  photo_url: z.string().optional(),
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

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type ProfileInput = z.infer<typeof ProfileSchema>;
export type LocationInput = z.infer<typeof LocationSchema>;
export type MessageInput = z.infer<typeof MessageSchema>;
