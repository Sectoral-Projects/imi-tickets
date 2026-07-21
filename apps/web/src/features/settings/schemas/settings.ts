import { z } from "zod";

export const staffRoleAliasSchema = z.object({
  roleId: z.string().min(1),
  alias: z.string().min(1).max(64),
});

export type StaffRoleAlias = z.infer<typeof staffRoleAliasSchema>;

export const wordFilterRuleSchema = z.object({
  term: z.string().min(1).max(100),
  match: z.enum(["keyword", "exact"]),
});

export type WordFilterRule = z.infer<typeof wordFilterRuleSchema>;

export const appSettingsSchema = z.object({
  closeAfterMinutes: z.number().positive().optional(),
  autoCloseReminderMinutes: z.number().positive().optional(),
  autoTagClosedThreads: z.boolean().optional(),
  notifyOnNewThread: z.boolean().optional(),
  notifyOnNewThreadRoleIds: z.array(z.string().min(1)).optional(),
  relayStaffTypingToMember: z.boolean().optional(),
  anonymousStaff: z.boolean().optional(),
  staffRoleAliases: z.array(staffRoleAliasSchema).optional(),
  ticketOpenButtonMode: z.enum(["off", "before_open"]).optional(),
  staffTicketOpenProfile: z.boolean().optional(),
  forwardTemplateButtonsToStaff: z.boolean().optional(),
  ticketChannelNameTemplate: z.string().max(100).nullable().optional(),
  useChannelNameForTranscript: z.boolean().optional(),
  commandPrefix: z.string().min(1).max(5).optional(),
  privateMessagePrefix: z.string().min(1).max(5).optional(),
  dmWordBlacklist: z.array(wordFilterRuleSchema).optional(),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

export const settingsResponseSchema = z.object({
  settings: appSettingsSchema,
  logChannelId: z.string().nullable(),
  transcriptChannelId: z.string().nullable(),
  primaryGuildId: z.string().nullable(),
  channelPanel: z.object({
    enabled: z.boolean(),
    channelId: z.string().nullable(),
    forumThreadId: z.string().nullable(),
    messageId: z.string().nullable(),
    forumPostTitle: z.string().nullable(),
    repostOnUpdate: z.boolean(),
  }),
  canManage: z.boolean(),
  canAdmin: z.boolean(),
});

export type SettingsResponse = z.infer<typeof settingsResponseSchema>;

export const settingsChannelsResponseSchema = z.object({
  guildId: z.string(),
  channels: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
    }),
  ),
});

export type SettingsChannelsResponse = z.infer<typeof settingsChannelsResponseSchema>;

export const settingsPanelChannelsResponseSchema = z.object({
  guildId: z.string(),
  channels: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.enum(["text", "forum"]).optional(),
    }),
  ),
});

export type SettingsPanelChannelsResponse = z.infer<typeof settingsPanelChannelsResponseSchema>;

export const settingsForumThreadsResponseSchema = z.object({
  guildId: z.string(),
  channelId: z.string(),
  threads: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
    }),
  ),
});

export type SettingsForumThreadsResponse = z.infer<typeof settingsForumThreadsResponseSchema>;

export const settingsRolesResponseSchema = z.object({
  guildId: z.string(),
  roles: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
    }),
  ),
});

export type SettingsRolesResponse = z.infer<typeof settingsRolesResponseSchema>;

export const updateSettingsSchema = z.object({
  settings: z
    .object({
      closeAfterMinutes: z.number().positive().nullable().optional(),
      autoCloseReminderMinutes: z.number().positive().nullable().optional(),
      autoTagClosedThreads: z.boolean().optional(),
      notifyOnNewThread: z.boolean().optional(),
      notifyOnNewThreadRoleIds: z.array(z.string().min(1)).optional(),
      relayStaffTypingToMember: z.boolean().optional(),
      anonymousStaff: z.boolean().optional(),
      staffRoleAliases: z.array(staffRoleAliasSchema).optional(),
      ticketOpenButtonMode: z.enum(["off", "before_open"]).optional(),
      staffTicketOpenProfile: z.boolean().optional(),
      forwardTemplateButtonsToStaff: z.boolean().optional(),
      ticketChannelNameTemplate: z.string().max(100).nullable().optional(),
      useChannelNameForTranscript: z.boolean().optional(),
      commandPrefix: z.string().min(1).max(5).optional(),
      privateMessagePrefix: z.string().min(1).max(5).optional(),
      dmWordBlacklist: z.array(wordFilterRuleSchema).optional(),
    })
    .partial()
    .optional(),
  logChannelId: z.string().nullable().optional(),
  transcriptChannelId: z.string().nullable().optional(),
  channelPanel: z
    .object({
      enabled: z.boolean().optional(),
      channelId: z.string().nullable().optional(),
      forumThreadId: z.string().nullable().optional(),
      forumPostTitle: z.string().nullable().optional(),
      repostOnUpdate: z.boolean().optional(),
    })
    .optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
