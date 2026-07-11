import type { EnrichedMessage } from "../../schemas/messages";
import type { TimelineItem } from "../../schemas/timeline";
import { formatAuditLabel } from "./audit";

const CHAIN_TIME_MS = 2 * 60 * 1000;

export type TimelineMessageBlock = {
  kind: "messages";
  messages: EnrichedMessage[];
};

export type TimelineAuditBlock = {
  kind: "audit";
  auditId: number;
  label: string;
  createdAt: string;
};

export type TimelineBlock = TimelineMessageBlock | TimelineAuditBlock;

/** Position of a message inside a visual chain group (for card chrome). */
export type MessageGroupPos = "solo" | "start" | "middle" | "end";

export type FlattenedTimelineRow =
  | {
      kind: "message";
      message: EnrichedMessage;
      groupPos: MessageGroupPos;
    }
  | {
      kind: "audit";
      auditId: number;
      label: string;
      createdAt: string;
    };

function messageHasReply(message: EnrichedMessage) {
  return Boolean(message.replyTo ?? message.replyToMessageId);
}

function canChain(previous: EnrichedMessage, next: EnrichedMessage) {
  if (messageHasReply(next) || messageHasReply(previous)) return false;

  const sameAuthor = previous.authorId === next.authorId;
  const sameChannel = previous.channelId === next.channelId;
  const withinWindow =
    new Date(next.createdAt).getTime() -
      new Date(previous.createdAt).getTime() <=
    CHAIN_TIME_MS;

  return sameAuthor && sameChannel && withinWindow;
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

export function buildTimelineBlocks(items: readonly TimelineItem[]): TimelineBlock[] {
  const orderedItems = pinThreadOpenedMarker(items);
  const blocks: TimelineBlock[] = [];
  let currentGroup: EnrichedMessage[] = [];

  const flushGroup = () => {
    if (currentGroup.length === 0) return;
    blocks.push({ kind: "messages", messages: currentGroup });
    currentGroup = [];
  };

  for (const item of orderedItems) {
    if (item.kind === "audit") {
      flushGroup();
      blocks.push({
        kind: "audit",
        auditId: item.audit.id,
        label: formatAuditLabel(item.audit),
        createdAt: item.audit.createdAt,
      });
      continue;
    }

    const message = item.message;

    if (messageHasReply(message)) {
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

/**
 * Flatten grouped blocks into one virtualizer row per message/audit.
 * Stable per-message keys are required for TanStack Virtual's end-anchored
 * prepend stability — grouping multiple messages under one key causes a
 * visible jump when older history merges into an existing group.
 */
export function flattenTimelineBlocks(blocks: readonly TimelineBlock[]): FlattenedTimelineRow[] {
  const rows: FlattenedTimelineRow[] = [];

  for (const block of blocks) {
    if (block.kind === "audit") {
      rows.push({
        kind: "audit",
        auditId: block.auditId,
        label: block.label,
        createdAt: block.createdAt,
      });
      continue;
    }

    const { messages } = block;
    if (messages.length === 1) {
      rows.push({ kind: "message", message: messages[0], groupPos: "solo" });
      continue;
    }

    messages.forEach((message, index) => {
      const groupPos: MessageGroupPos =
        index === 0 ? "start" : index === messages.length - 1 ? "end" : "middle";
      rows.push({ kind: "message", message, groupPos });
    });
  }

  return rows;
}
