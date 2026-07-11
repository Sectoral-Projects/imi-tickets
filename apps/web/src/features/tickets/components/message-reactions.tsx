import { cn } from "@/lib/utils";
import type { MessageReaction } from "../schemas/messages";

function reactionEmojiUrl(emoji: MessageReaction["emoji"]) {
  if (!emoji.id) return null;

  const extension = emoji.animated ? "gif" : "webp";
  return `https://cdn.discordapp.com/emojis/${emoji.id}.${extension}?size=20&quality=lossless`;
}

function ReactionEmoji({ emoji }: { emoji: MessageReaction["emoji"] }) {
  const url = reactionEmojiUrl(emoji);

  if (url) {
    return (
      <img
        src={url}
        alt={emoji.name}
        className="size-4 shrink-0 object-contain"
        loading="lazy"
      />
    );
  }

  return <span className="text-base leading-none">{emoji.name}</span>;
}

export function MessageReactions({
  reactions,
  currentUserId,
}: {
  reactions: MessageReaction[];
  currentUserId?: string | null;
}) {
  if (reactions.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {reactions.map((reaction) => {
        const reacted = Boolean(currentUserId && reaction.userIds.includes(currentUserId));

        return (
          <span
            key={`${reaction.emoji.id ?? reaction.emoji.name}`}
            title={`${reaction.count} reaction${reaction.count === 1 ? "" : "s"}`}
            className={cn(
              "inline-flex h-[22px] min-w-[22px] items-center gap-1 rounded-lg px-1.5 text-xs font-medium tabular-nums transition-colors",
              reacted
                ? "border border-primary/25 bg-primary/10 text-primary"
                : "border border-transparent bg-muted/70 text-muted-foreground hover:border-border hover:bg-muted",
            )}
          >
            <ReactionEmoji emoji={reaction.emoji} />
            <span>{reaction.count}</span>
          </span>
        );
      })}
    </div>
  );
}
