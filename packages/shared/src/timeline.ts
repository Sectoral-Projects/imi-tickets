import type { EnrichedMessage } from "./messages";

export const MESSAGE_GROUP_WINDOW_MS = 2 * 60 * 1000;
export const MAX_ADJACENT_GROUP_MESSAGES = 30;

/** Full-transcript infinite-scroll page size in complete groups. */
export const TIMELINE_GROUP_LIMIT = 15;

/** Highlight / reply window: groups before and after the anchor. */
export const TIMELINE_WINDOW_GROUP_LIMIT = 8;

/** Hard cap on rows returned in one page (guards max-size chains). */
export const MAX_TIMELINE_ROWS_PER_PAGE = 90;

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

/**
 * Take up to `groupLimit` complete groups from a prefetched row buffer.
 * Audits (and any row where `isSingletonGroup` is true) are one group each.
 * Message chains continue while `canContinueGroup(edge, candidate)` is true,
 * capped at `MAX_ADJACENT_GROUP_MESSAGES` per chain and `maxRows` overall.
 */
export function takeCompleteGroups<T>(
  rows: readonly T[],
  groupLimit: number,
  canContinueGroup: (currentEdge: T, candidate: T) => boolean,
  isSingletonGroup: (row: T) => boolean,
  maxRows = MAX_TIMELINE_ROWS_PER_PAGE,
  maxMessagesPerGroup = MAX_ADJACENT_GROUP_MESSAGES,
) {
  if (rows.length === 0 || groupLimit <= 0 || maxRows <= 0) return [] as T[];

  const page: T[] = [];
  let groupsTaken = 0;
  let index = 0;

  while (
    index < rows.length &&
    groupsTaken < groupLimit &&
    page.length < maxRows
  ) {
    const head = rows[index];
    if (head === undefined) break;

    page.push(head);
    index += 1;

    if (isSingletonGroup(head)) {
      groupsTaken += 1;
      continue;
    }

    let messagesInGroup = 1;
    while (
      index < rows.length &&
      page.length < maxRows &&
      messagesInGroup < maxMessagesPerGroup
    ) {
      const edge = page.at(-1);
      const candidate = rows[index];
      if (
        edge === undefined ||
        candidate === undefined ||
        isSingletonGroup(candidate) ||
        !canContinueGroup(edge, candidate)
      ) {
        break;
      }

      page.push(candidate);
      index += 1;
      messagesInGroup += 1;
    }

    groupsTaken += 1;
  }

  return page;
}

/** SQL / buffer size: enough rows for `groupLimit` max-size groups, plus one. */
export function timelineGroupFetchRowLimit(
  groupLimit: number,
  maxRows = MAX_TIMELINE_ROWS_PER_PAGE,
) {
  return Math.min(groupLimit * MAX_ADJACENT_GROUP_MESSAGES, maxRows) + 1;
}

/**
 * @deprecated Prefer `takeCompleteGroups` for group-based paging.
 * Kept for callers that still extend a fixed row page to a group edge.
 */
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
