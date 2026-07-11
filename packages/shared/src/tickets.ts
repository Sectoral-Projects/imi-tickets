import * as z from "zod";

export const memberSnapshotSchema = z.object({
  id: z.number(),
  userId: z.string(),
  username: z.string().nullable(),
  globalName: z.string().nullable(),
  avatar: z.string().nullable(),
  roleIds: z.array(z.string()).nullable(),
  highestRoleId: z.string().nullable(),
  nickname: z.string().nullable(),
  capturedAt: z.date(),
});

export const latestMessageSchema = z.object({
  id: z.number(),
  threadId: z.number(),
  channelId: z.string(),
  authorId: z.string(),
  messageId: z.string(),
  content: z.string(),
  revision: z.number(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
  deletedAt: z.date().nullable(),
});

export const ticketSchema = z.object({
  id: z.number(),
  userId: z.string(),
  status: z.string(),
  channelId: z.string().nullable(),
  dmChannelId: z.string().nullable(),
  hideMemberIdentities: z.boolean().default(false),
  subject: z.string().nullable(),
  staffChannelName: z.string().nullable().optional(),
  lastMessageAt: z.date().nullable(),
  createdAt: z.date(),
  closedAt: z.date().nullable(),
  deletedAt: z.date().nullable(),
});

export const threadParticipantSchema = z.object({
  threadId: z.number(),
  userId: z.string(),
  role: z.string(),
  dmChannelId: z.string().nullable(),
  joinedAt: z.date(),
  lastReadAt: z.date().nullable(),
  deletedAt: z.date().nullable(),
  user: memberSnapshotSchema.nullable(),
});

export const ticketWithParticipantsSchema = ticketSchema.extend({
  participants: z.array(threadParticipantSchema),
});

export const enrichedTicketSchema = ticketSchema.extend({
  latestMessage: latestMessageSchema.nullable(),
  user: memberSnapshotSchema.nullable(),
});

export type LatestMessage = z.infer<typeof latestMessageSchema>;
export type MemberSnapshot = z.infer<typeof memberSnapshotSchema>;
export type Ticket = z.infer<typeof ticketSchema>;
export type ThreadParticipant = z.infer<typeof threadParticipantSchema>;
export type TicketWithParticipants = z.infer<typeof ticketWithParticipantsSchema>;
export type EnrichedTicket = z.infer<typeof enrichedTicketSchema>;