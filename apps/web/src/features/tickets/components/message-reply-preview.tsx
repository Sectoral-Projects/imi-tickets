import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { MessageReplyPreview } from "../schemas/messages";

const AVATAR_SIZE_PX = 40;
const REPLY_ROW_HEIGHT_PX = 20;

function truncateReplyContent(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= 80) return normalized;
  return `${normalized.slice(0, 77)}…`;
}

function replyAuthorAvatarUrl(replyTo: MessageReplyPreview) {
  if (!replyTo.authorAvatar) return undefined;
  return `https://cdn.discordapp.com/avatars/${replyTo.authorId}/${replyTo.authorAvatar}.png`;
}

function ReplyConnector() {
  const height = REPLY_ROW_HEIGHT_PX - 5;

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute top-0 left-0 text-muted-foreground/35"
      width={45}
      height={height}
      viewBox={`0 0 52 ${height}`}
    >
      <path
        d={`M 20 ${height} L 20 12 Q 20 6 26 6 L 52 6`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MessageReplyLeadingColumn({
  hasReply,
  children,
}: {
  hasReply: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="relative w-10 shrink-0"
      style={{ height: hasReply ? REPLY_ROW_HEIGHT_PX + AVATAR_SIZE_PX : AVATAR_SIZE_PX }}
    >
      {hasReply ? <ReplyConnector /> : null}
      <div className="absolute bottom-0 left-0">{children}</div>
    </div>
  );
}

export function MessageReplySnippet({
  replyTo,
  onJump,
}: {
  replyTo: MessageReplyPreview;
  onJump: (messageId: number) => void;
}) {
  const authorLabel = replyTo.authorName ?? "Unknown user";
  const isDeleted = Boolean(replyTo.deletedAt);
  const preview = truncateReplyContent(replyTo.content);
  const avatarUrl = replyAuthorAvatarUrl(replyTo);

  return (
    <button
      type="button"
      className={cn(
        "group/reply flex max-w-full min-w-0 cursor-pointer items-center gap-1.5 text-left pb-1",
        "rounded-sm transition-colors hover:underline",
      )}
      style={{ height: REPLY_ROW_HEIGHT_PX }}
      onClick={(event) => {
        event.stopPropagation();
        onJump(replyTo.id);
      }}
    >
      <Avatar className="size-4 shrink-0">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt={authorLabel} /> : null}
        <AvatarFallback className="text-[8px]">{authorLabel.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="shrink-0 text-xs font-semibold text-muted-foreground group-hover/reply:text-foreground">
        {authorLabel}
      </span>
      <span
        className={cn(
          "min-w-0 truncate text-xs text-muted-foreground/80",
          isDeleted && "italic",
        )}
      >
        {isDeleted ? `(deleted) ${preview}` : preview}
      </span>
    </button>
  );
}
