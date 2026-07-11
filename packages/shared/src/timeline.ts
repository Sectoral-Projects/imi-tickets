import type { EnrichedMessage } from "./messages";

export type AuditTimelineEntry = {
  id: number;
  action: string;
  executedBy: string;
  threadId: number | null;
  messageId: string | null;
  noteId: number | null;
  userId: string | null;
  channelId: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

export type TimelineMessageItem = {
  kind: "message";
  message: EnrichedMessage;
};

export type TimelineAuditItem = {
  kind: "audit";
  audit: AuditTimelineEntry;
};

export type TimelineItem = TimelineMessageItem | TimelineAuditItem;

export type TimelineResponse = {
  items: TimelineItem[];
  nextCursor: number | null;
};

export type TimelineWindowResponse = {
  items: TimelineItem[];
  previousCursor: string | null;
  nextCursor: string | null;
  anchorMessageId: number | null;
};