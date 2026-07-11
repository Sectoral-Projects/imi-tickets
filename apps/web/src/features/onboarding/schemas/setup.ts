import * as z from "zod";

export const setupPermissionSchema = z.enum(["READ", "MANAGE", "ADMIN"]);
export type SetupPermission = z.infer<typeof setupPermissionSchema>;

export const channelStrategySchema = z.enum(["category", "forum"]);
export type ChannelStrategy = z.infer<typeof channelStrategySchema>;

export const rolePermissionSchema = z.object({
  roleId: z.string(),
  permissions: z.array(setupPermissionSchema),
});
export type RolePermission = z.infer<typeof rolePermissionSchema>;

export const linkedGuildStatusSchema = z.object({
  guildId: z.string(),
  name: z.string().nullable(),
  isPrimary: z.boolean(),
  channelStrategy: z.string().nullable(),
  categoryChannelId: z.string().nullable(),
  forumChannelId: z.string().nullable(),
  rolePermissions: z.array(rolePermissionSchema),
});
export type LinkedGuildStatus = z.infer<typeof linkedGuildStatusSchema>;

export const setupStatusSchema = z.object({
  complete: z.boolean(),
  hasCustomRbacConfig: z.boolean(),
  primaryGuildId: z.string().nullable(),
  setupOwnerUserId: z.string().nullable(),
  isSetupOwner: z.boolean(),
  canClaimSetup: z.boolean(),
  linkedGuilds: z.array(linkedGuildStatusSchema),
  missingRequirements: z.array(z.string()),
});
export type SetupStatus = z.infer<typeof setupStatusSchema>;

export const discordSetupGuildSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  owner: z.boolean(),
  permissions: z.string(),
  isAdministrator: z.boolean(),
  botPresent: z.boolean(),
  inviteUrl: z.string(),
});
export type DiscordSetupGuild = z.infer<typeof discordSetupGuildSchema>;

export const setupGuildsResponseSchema = z.object({
  needsReauth: z.boolean(),
  guilds: z.array(discordSetupGuildSchema),
});
export type SetupGuildsResponse = z.infer<typeof setupGuildsResponseSchema>;

export const setupResourceRoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.number(),
});
export type SetupResourceRole = z.infer<typeof setupResourceRoleSchema>;

export const setupResourceChannelRefSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type SetupResourceChannelRef = z.infer<typeof setupResourceChannelRefSchema>;

export const setupResourcesSchema = z.object({
  roles: z.array(setupResourceRoleSchema),
  categories: z.array(setupResourceChannelRefSchema),
  forums: z.array(setupResourceChannelRefSchema),
});
export type SetupResources = z.infer<typeof setupResourcesSchema>;
