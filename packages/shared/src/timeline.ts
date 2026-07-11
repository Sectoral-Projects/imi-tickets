import type { EnrichedMessage } from "./messages";

export const MESSAGE_GROUP_WINDOW_MS = 2 * 60 * 1000;
export const MAX_ADJACENT_GROUP_MESSAGES = 30;

export type AdjacentMessageGroupCandidate = {
  authorId: string | null;
  channelId: string | null;
  createdAt: string | number | Date;
  isPrivateStaff: boolean;
  hasReply: boolean;
};

export function canGroupAdjacentMessages(
  older: AdjacentMessageGroupCandidate,
  newer: AdjacentMessageGroupCandidate,
) {
  if (
    older.isPrivateStaff ||
    newer.isPrivateStaff ||
    older.hasReply ||
    newer.hasReply
  ) {
    return false;
  }
  if (
    older.authorId !== newer.authorId ||
    older.channelId !== newer.channelId
  ) {
    return false;
  }

  const elapsed =
    new Date(newer.createdAt).getTime() - new Date(older.createdAt).getTime();
  return elapsed >= 0 && elapsed <= MESSAGE_GROUP_WINDOW_MS;
}

export function completePageAtGroupBoundary<T>(
  rows: readonly T[],
  baseLimit: number,
  canAppend: (currentEdge: T, candidate: T) => boolean,
  maxExtra = MAX_ADJACENT_GROUP_MESSAGES,
) {
  const page = rows.slice(0, baseLimit);
  if (page.length < baseLimit) return page;

  let extras = 0;
  while (page.length < rows.length && extras < maxExtra) {
    const currentEdge = page.at(-1);
    const candidate = rows[page.length];
    if (
      currentEdge === undefined ||
      candidate === undefined ||
      !canAppend(currentEdge, candidate)
    ) {
      break;
    }

    page.push(candidate);
    extras += 1;
  }

  return page;
}

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