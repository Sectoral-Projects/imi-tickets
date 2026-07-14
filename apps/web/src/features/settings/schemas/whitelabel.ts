import { z } from "zod";

export const whitelabelActivityTypeSchema = z.enum([
  "playing",
  "listening",
  "watching",
  "competing",
  "custom",
]);

export type WhitelabelActivityType = z.infer<typeof whitelabelActivityTypeSchema>;

export const whitelabelPresenceSchema = z.object({
  statusText: z.string(),
  activityType: whitelabelActivityTypeSchema,
});

export const whitelabelGuildSchema = z.object({
  id: z.string(),
  name: z.string(),
  iconUrl: z.string().nullable(),
  isPrimary: z.boolean(),
});

export const whitelabelProfileSchema = z.object({
  guildId: z.string(),
  nick: z.string().nullable(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  username: z.string(),
  globalAvatarUrl: z.string().nullable(),
});

export const whitelabelResponseSchema = z.object({
  primaryGuildId: z.string().nullable(),
  guilds: z.array(whitelabelGuildSchema),
  profile: whitelabelProfileSchema.nullable(),
  presence: whitelabelPresenceSchema,
});

export type WhitelabelResponse = z.infer<typeof whitelabelResponseSchema>;

export const updateWhitelabelInputSchema = z.object({
  guildId: z.string().min(1),
  nick: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  avatarDataUri: z.string().nullable().optional(),
  clearAvatar: z.boolean().optional(),
  statusText: z.string().optional(),
  activityType: whitelabelActivityTypeSchema.optional(),
});

export type UpdateWhitelabelInput = z.infer<typeof updateWhitelabelInputSchema>;

export const ACTIVITY_TYPE_OPTIONS: Array<{
  value: WhitelabelActivityType;
  label: string;
}> = [
  { value: "playing", label: "Playing" },
  { value: "listening", label: "Listening to" },
  { value: "watching", label: "Watching" },
  { value: "competing", label: "Competing in" },
  { value: "custom", label: "Custom status" },
];
