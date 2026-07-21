import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { EnrichedMessage } from "../schemas/messages";
import type { Ticket, ThreadParticipant } from "../schemas/tickets";
import type { MessageGroupPos } from "../utils/timeline/blocks";
import { resolveMessageSourceLabel } from "../utils/timeline/message-source";
import { isSystemTranscriptMessage } from "../utils/system-message";
import { MessageMedia } from "./message-media";
import { MessageMarkdown } from "./message-markdown";
import { MessageCopyMenu } from "./message-copy-menu";
import { MessageEditIndicator } from "./message-edit-indicator";
import { MessageDeletedIndicator } from "./message-deleted-indicator";
import { MessageStaffCommandIndicator } from "./message-staff-command-indicator";
import { MessageReactions } from "./message-reactions";
import {
  MessageReplyLeadingColumn,
  MessageReplySnippet,
} from "./message-reply-preview";
import { AuthorHoverCard } from "./author-hover-card";
import { ForwardedMessageFrame } from "./forwarded-message";
import { LinkPreviewCard } from "./link-preview-card";
import {
  dedupeEmbedVideoAttachments,
  isEmbedVideoAttachment,
  shouldRenderInlineMedia,
  TRANSCRIPT_FORWARDED_MEDIA_INSET_PX,
} from "../utils/message-media";
import { mediaMaxWidthForGroupPos } from "../utils/timeline/estimate-row-size";

// --- Surface styling ---

const messageRowHighlightClass = "bg-primary/10";
const messageReplyJumpFlashClass =
  "animate-reply-jump-highlight rounded-[inherit]";

function messageRowSurfaceClass({
  highlighted,
  replyJumpFlashing,
}: {
  highlighted: boolean;
  replyJumpFlashing: boolean;
}) {
  if (replyJumpFlashing) return messageReplyJumpFlashClass;
  if (highlighted) return messageRowHighlightClass;
  return "hover:bg-muted/40";
}

function messageGroupShellClass(groupPos: MessageGroupPos) {
  switch (groupPos) {
    case "solo":
      return "rounded-xl border border-border bg-card";
    case "start":
      return "rounded-t-xl border border-b-0 border-border bg-card";
    case "middle":
      return "border-x border-border bg-card";
    case "end":
      return "rounded-b-xl border border-t-0 border-border bg-card";
  }
}

export function MessageGroupShell({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative rounded-xl border border-border bg-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

// --- Sub-components ---

function MessageBody({
  message,
  mediaMaxWidthPx,
}: {
  message: EnrichedMessage;
  mediaMaxWidthPx?: number;
}) {
  const embedVideoAttachments = dedupeEmbedVideoAttachments(
    message.attachments.filter(isEmbedVideoAttachment),
  );
  const inlineAttachments = message.attachments.filter(
    (attachment) =>
      shouldRenderInlineMedia(attachment) &&
      !isEmbedVideoAttachment(attachment),
  );
  const fileAttachments = message.attachments.filter(
    (attachment) =>
      !shouldRenderInlineMedia(attachment) &&
      !isEmbedVideoAttachment(attachment),
  );
  const hasTextContent = message.content.trim().length > 0;
  const inlineMaxWidthPx =
    mediaMaxWidthPx != null && message.isForwarded
      ? Math.max(1, mediaMaxWidthPx - TRANSCRIPT_FORWARDED_MEDIA_INSET_PX)
      : mediaMaxWidthPx;

  return (
    <>
      {hasTextContent && <MessageMarkdown content={message.content} />}

      {embedVideoAttachments.length > 0 && (
        <div
          className={cn("flex flex-col gap-2", hasTextContent ? "mt-2" : "")}
        >
          {embedVideoAttachments.map((attachment) => (
            <LinkPreviewCard key={attachment.id} attachment={attachment} />
          ))}
        </div>
      )}

      {inlineAttachments.length > 0 && (
        <div
          className={cn(
            "flex flex-col gap-2",
            hasTextContent || embedVideoAttachments.length > 0 ? "mt-2" : "",
          )}
        >
          {inlineAttachments.map((attachment) => (
            <MessageMedia
              key={attachment.id}
              attachment={attachment}
              maxWidthPx={inlineMaxWidthPx}
            />
          ))}
        </div>
      )}

      {fileAttachments.length > 0 && (
        <div
          className={cn(
            "flex flex-col gap-1",
            hasTextContent ||
              embedVideoAttachments.length > 0 ||
              inlineAttachments.length > 0
              ? "mt-2"
              : "",
          )}
        >
          {fileAttachments.map((attachment) => (
            <a
              key={attachment.id}
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary underline"
              onClick={(event) => event.stopPropagation()}
            >
              {attachment.name ?? attachment.url}
            </a>
          ))}
        </div>
      )}
    </>
  );
}

function MessageContent({
  message,
  mediaMaxWidthPx,
}: {
  message: EnrichedMessage;
  mediaMaxWidthPx?: number;
}) {
  if (message.isForwarded) {
    return (
      <ForwardedMessageFrame>
        <MessageBody message={message} mediaMaxWidthPx={mediaMaxWidthPx} />
      </ForwardedMessageFrame>
    );
  }

  return <MessageBody message={message} mediaMaxWidthPx={mediaMaxWidthPx} />;
}

function MessageRowCopyAction({ content }: { content: string }) {
  if (!content.trim()) return null;

  return (
    <div className="pointer-events-none absolute right-3 bottom-2 z-10 opacity-0 transition-opacity group-hover/message:opacity-100 group-focus-within/message:opacity-100">
      <div className="pointer-events-auto">
        <MessageCopyMenu content={content} />
      </div>
    </div>
  );
}

function PrivateMessageBadge() {
  return (
    <Badge
      variant="outline"
      className="h-5 gap-1 px-1.5 text-[10px] font-medium normal-case text-muted-foreground"
    >
      <Lock className="size-2.5" aria-hidden />
      Private
    </Badge>
  );
}

// --- Main export ---

export function MessageTimelineRow({
  message,
  groupPos,
  ticket,
  highlighted,
  replyJumpFlashing,
  onToggleHighlight,
  onScrollToMessage,
  currentUserId,
  mediaMaxWidthPx,
  renderShell = true,
}: {
  message: EnrichedMessage;
  groupPos: MessageGroupPos;
  ticket: Pick<Ticket, "dmChannelId" | "channelId" | "userId"> & {
    participants?: Pick<ThreadParticipant, "dmChannelId" | "userId" | "role">[];
  };
  highlighted: boolean;
  replyJumpFlashing: boolean;
  onToggleHighlight: (messageId: number) => void;
  onScrollToMessage: (messageId: number) => void;
  currentUserId?: string | null;
  mediaMaxWidthPx?: number;
  /** When false, omit per-message card chrome (used inside MessageGroupCard). */
  renderShell?: boolean;
}) {
  const isLead = groupPos === "solo" || groupPos === "start";
  const isSystemMessage = isSystemTranscriptMessage(message.authorId);
  const sourceLabel = resolveMessageSourceLabel(
    message.channelId,
    ticket,
    message.authorId,
  );
  const displayName = isSystemMessage
    ? "System"
    : (message.author?.username ??
      message.author?.globalName ??
      message.authorId);
  const rowMediaMaxWidth =
    mediaMaxWidthPx != null
      ? mediaMaxWidthForGroupPos(mediaMaxWidthPx, groupPos)
      : undefined;

  const content = (
    <>
      {isLead ? (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
          {message.isPrivateStaff ? <PrivateMessageBadge /> : null}
          <Badge
            variant={
              sourceLabel === "DM"
                ? "secondary"
                : sourceLabel == "Staff"
                  ? "default"
                  : "outline"
            }
            className="h-5 px-2 text-[10px] font-semibold tracking-wide uppercase"
          >
            {sourceLabel}
          </Badge>
        </div>
      ) : null}

      {isLead ? (
        <div
          data-message-id={message.id}
          className={cn(
            "group/message relative flex items-start gap-3 p-4 pr-16 transition-colors",
            groupPos === "solo" ? "pb-4" : "pb-1",
            messageRowSurfaceClass({ highlighted, replyJumpFlashing }),
          )}
          onClick={() => onToggleHighlight(message.id)}
        >
          <MessageReplyLeadingColumn hasReply={Boolean(message.replyTo)}>
            {isSystemMessage ? (
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback>SY</AvatarFallback>
              </Avatar>
            ) : (
              <AuthorHoverCard userId={message.authorId}>
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage
                    src={
                      message.author?.avatar
                        ? `https://cdn.discordapp.com/avatars/${message.author.userId}/${message.author.avatar}.png`
                        : undefined
                    }
                    alt={displayName}
                  />
                  <AvatarFallback>{displayName.slice(0, 2)}</AvatarFallback>
                </Avatar>
              </AuthorHoverCard>
            )}
          </MessageReplyLeadingColumn>

          <div className="min-w-0 flex-1">
            {message.replyTo ? (
              <MessageReplySnippet
                replyTo={message.replyTo}
                onJump={onScrollToMessage}
              />
            ) : null}

            <div className="flex items-baseline gap-2">
              {isSystemMessage ? (
                <span className="font-medium">{displayName}</span>
              ) : (
                <AuthorHoverCard userId={message.authorId}>
                  <span className="font-medium">{displayName}</span>
                </AuthorHoverCard>
              )}
              <span className="text-xs text-muted-foreground">
                {new Date(message.createdAt).toLocaleString()}
              </span>
              <MessageStaffCommandIndicator message={message} />
              <MessageDeletedIndicator message={message} />
              <MessageEditIndicator message={message} />
            </div>

            <div className="mt-1">
              <MessageContent
                message={message}
                mediaMaxWidthPx={rowMediaMaxWidth}
              />
              <MessageReactions
                reactions={message.reactions}
                currentUserId={currentUserId}
              />
            </div>
          </div>
          <MessageRowCopyAction content={message.content} />
        </div>
      ) : (
        <div
          data-message-id={message.id}
          className={cn(
            "group/message relative flex gap-1 px-4 pr-3 pt-1 transition-colors",
            groupPos === "end" ? "pb-4" : "pb-1",
            messageRowSurfaceClass({ highlighted, replyJumpFlashing }),
          )}
          onClick={() => onToggleHighlight(message.id)}
        >
          <div className="flex w-[48px] shrink-0 justify-center content-center">
            <span className="text-[10px] text-muted-foreground opacity-0 transition-opacity content-center group-hover/message:opacity-100 group-focus-within/message:opacity-100">
              {new Date(message.createdAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>

          <div className="relative min-w-0 flex-1">
            {message.revision > 1 ||
            message.updatedAt ||
            message.deletedAt ||
            message.isPrivateStaff ||
            message.staffCommand ? (
              <div className="absolute right-0 top-0 flex items-center gap-2">
                {message.isPrivateStaff ? <PrivateMessageBadge /> : null}
                <MessageStaffCommandIndicator message={message} />
                <MessageDeletedIndicator message={message} />
                {message.revision > 1 || message.updatedAt ? (
                  <MessageEditIndicator message={message} />
                ) : null}
              </div>
            ) : null}
            {message.replyTo ? (
              <MessageReplySnippet
                replyTo={message.replyTo}
                onJump={onScrollToMessage}
              />
            ) : null}
            <MessageContent
              message={message}
              mediaMaxWidthPx={rowMediaMaxWidth}
            />
            <MessageReactions
              reactions={message.reactions}
              currentUserId={currentUserId}
            />
          </div>
          <MessageRowCopyAction content={message.content} />
        </div>
      )}
    </>
  );

  if (!renderShell) {
    return <div className="relative">{content}</div>;
  }

  return (
    <div className={cn("relative", messageGroupShellClass(groupPos))}>
      {content}
    </div>
  );
}