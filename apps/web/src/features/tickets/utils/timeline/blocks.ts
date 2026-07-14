import type { EnrichedMessage } from "../../schemas/messages";
import type { TimelineItem } from "../../schemas/timeline";
import { canGroupAdjacentMessages } from "@imi/tickets-shared";
import { formatAuditLabel, resolveScheduledCloseAt } from "./audit";

export type TimelineMessageBlock = {
  kind: "messages";
  messages: EnrichedMessage[];
};

export type TimelineAuditBlock = {
  kind: "audit";
  auditId: number;
  action: string;
  label: string;
  createdAt: string;
  /** ISO closesAt for live scheduled-close countdowns. */
  closesAt?: string | null;
  /** Member user id for hoverable mentions (e.g. participant.added). */
  userId?: string | null;
  dmUnreachable?: boolean;
};

export type TimelineBlock = TimelineMessageBlock | TimelineAuditBlock;

/** Position of a message inside a visual chain group (for card chrome). */
export type MessageGroupPos = "solo" | "start" | "middle" | "end";

export function timelineItemKey(item: TimelineItem) {
  return item.kind === "message"
    ? `message-${item.message.id}`
    : `audit-${item.audit.id}`;
}

/** Stable virtualizer key for a built timeline block. */
export function timelineBlockKey(block: TimelineBlock) {
  if (block.kind === "audit") return `audit-${block.auditId}`;
  return `group-${block.messages[0]!.id}`;
}

/**
 * Dev-only: after a history prepend, previously loaded blocks must remain an
 * unchanged suffix with unique keys (TanStack `anchorTo: "end"` contract).
 * Full replacements (seek / window seed) skip this check.
 */
export function assertStableBlockPrepend(
  previous: readonly TimelineBlock[],
  next: readonly TimelineBlock[],
) {
  if (!import.meta.env.DEV) return;
  if (previous.length === 0 || next.length <= previous.length) return;

  const prevKeys = previous.map(timelineBlockKey);
  const nextKeys = next.map(timelineBlockKey);

  const seen = new Set<string>();
  for (const key of nextKeys) {
    if (seen.has(key)) {
      throw new Error(
        `Timeline block key "${key}" duplicated after prepend — keys must be unique for anchorTo:"end".`,
      );
    }
    seen.add(key);
  }

  // Prepend: first key changed and previous keys are the new suffix.
  if (nextKeys[0] === prevKeys[0]) return;

  const suffix = nextKeys.slice(nextKeys.length - prevKeys.length);
  for (let index = 0; index < prevKeys.length; index += 1) {
    if (suffix[index] !== prevKeys[index]) {
      throw new Error(
        `Timeline prepend broke immutable block suffix at index ${index}: expected "${prevKeys[index]}", got "${suffix[index]}".`,
      );
    }
  }
}

export function messageGroupPosForIndex(
  index: number,
  count: number,
): MessageGroupPos {
  if (count === 1) return "solo";
  if (index === 0) return "start";
  if (index === count - 1) return "end";
  return "middle";
}

function messageHasReply(message: EnrichedMessage) {
  return Boolean(message.replyTo ?? message.replyToMessageId);
}

function messageIsPrivateStaff(message: EnrichedMessage) {
  return Boolean(message.isPrivateStaff);
}

/** Replies and private staff notes always start their own visual group. */
function messageStartsNewGroup(message: EnrichedMessage) {
  return messageHasReply(message) || messageIsPrivateStaff(message);
}

function canChain(previous: EnrichedMessage, next: EnrichedMessage) {
  return canGroupAdjacentMessages(
    {
      authorId: previous.authorId,
      channelId: previous.channelId,
      createdAt: previous.createdAt,
      isPrivateStaff: previous.isPrivateStaff,
      hasReply: messageHasReply(previous),
    },
    {
      authorId: next.authorId,
      channelId: next.channelId,
      createdAt: next.createdAt,
      isPrivateStaff: next.isPrivateStaff,
      hasReply: messageHasReply(next),
    },
  );
}

function pinThreadOpenedMarker(items: readonly TimelineItem[]): TimelineItem[] {
  const openedIndex = items.findIndex(
    (item) =>
      item.kind === "audit" && item.audit.action === "thread.created",
  );
  if (openedIndex === -1) return [...items];

  const firstMessageIndex = items.findIndex((item) => item.kind === "message");
  if (firstMessageIndex === -1) return [...items];
  if (openedIndex < firstMessageIndex) return [...items];

  const opened = items[openedIndex];
  const withoutOpened = items.filter((_, index) => index !== openedIndex);
  const insertAt = withoutOpened.findIndex((item) => item.kind === "message");

  return [
    ...withoutOpened.slice(0, insertAt),
    opened,
    ...withoutOpened.slice(insertAt),
  ];
}

export function buildTimelineBlocks(
  items: readonly TimelineItem[],
  breakBeforeKeys: ReadonlySet<string> = new Set(),
): TimelineBlock[] {
  const orderedItems = pinThreadOpenedMarker(items);
  const blocks: TimelineBlock[] = [];
  let currentGroup: EnrichedMessage[] = [];

  const flushGroup = () => {
    if (currentGroup.length === 0) return;
    blocks.push({ kind: "messages", messages: currentGroup });
    currentGroup = [];
  };

  for (const item of orderedItems) {
    // Pages are loaded independently. Never let a newly prepended/appended page
    // reshape the group chrome (and therefore measured height) of an existing
    // boundary row.
    if (breakBeforeKeys.has(timelineItemKey(item))) {
      flushGroup();
    }

    if (item.kind === "audit") {
      flushGroup();
      const payload = item.audit.payload ?? {};
      const closesAtRaw = payload.closesAt;
      const userId =
        typeof payload.userId === "string" && payload.userId.trim()
          ? payload.userId.trim()
          : typeof item.audit.userId === "string" && item.audit.userId.trim()
            ? item.audit.userId.trim()
            : null;
      blocks.push({
        kind: "audit",
        auditId: item.audit.id,
        action: item.audit.action,
        label: formatAuditLabel(item.audit),
        createdAt: item.audit.createdAt,
        userId,
        dmUnreachable: payload.dmUnreachable === true,
        closesAt:
          item.audit.action === "thread.close.scheduled" &&
          (typeof closesAtRaw === "string" || typeof closesAtRaw === "number") &&
          resolveScheduledCloseAt(closesAtRaw) != null
            ? typeof closesAtRaw === "string"
              ? closesAtRaw
              : new Date(closesAtRaw).toISOString()
            : null,
      });
      continue;
    }

    const message = item.message;

    if (messageStartsNewGroup(message)) {
      flushGroup();
      blocks.push({ kind: "messages", messages: [message] });
      continue;
    }

    const previous = currentGroup.at(-1);

    if (previous && canChain(previous, message)) {
      currentGroup.push(message);
    } else {
      flushGroup();
      currentGroup = [message];
    }
  }

  flushGroup();
  return blocks;
}
