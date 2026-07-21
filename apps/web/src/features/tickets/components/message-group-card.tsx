import type { EnrichedMessage } from "../schemas/messages";
import type { Ticket, ThreadParticipant } from "../schemas/tickets";
import {
  messageGroupPosForIndex,
} from "../utils/timeline/blocks";
import {
  MessageGroupShell,
  MessageTimelineRow,
} from "./ticket-message-row";

type MessageGroupCardProps = {
  messages: EnrichedMessage[];
  ticket: Pick<Ticket, "dmChannelId" | "channelId" | "userId"> & {
    participants?: Pick<ThreadParticipant, "dmChannelId" | "userId" | "role">[];
  };
  highlightedMessageIds: ReadonlySet<number>;
  replyJumpFlashMessageId: number | null;
  onToggleHighlight: (messageId: number) => void;
  onScrollToMessage: (messageId: number) => void;
  currentUserId?: string | null;
  mediaMaxWidthPx?: number;
};

/** One virtualizer item: a single card containing a same-author message chain. */
export function MessageGroupCard({
  messages,
  ticket,
  highlightedMessageIds,
  replyJumpFlashMessageId,
  onToggleHighlight,
  onScrollToMessage,
  currentUserId,
  mediaMaxWidthPx,
}: MessageGroupCardProps) {
  return (
    <MessageGroupShell>
      {messages.map((message, index) => (
        <MessageTimelineRow
          key={message.id}
          message={message}
          groupPos={messageGroupPosForIndex(index, messages.length)}
          ticket={ticket}
          highlighted={highlightedMessageIds.has(message.id)}
          replyJumpFlashing={replyJumpFlashMessageId === message.id}
          onToggleHighlight={onToggleHighlight}
          onScrollToMessage={onScrollToMessage}
          currentUserId={currentUserId}
          mediaMaxWidthPx={mediaMaxWidthPx}
          renderShell={false}
        />
      ))}
    </MessageGroupShell>
  );
}
