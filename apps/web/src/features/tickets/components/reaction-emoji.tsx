import { cn } from "@/lib/utils";
import { discordCustomEmojiUrl, twemojiSvgUrl } from "@/lib/twemoji";
import type { MessageReaction } from "../schemas/messages";

function reactionCustomEmojiUrl(emoji: MessageReaction["emoji"]) {
  if (!emoji.id) return null;
  return discordCustomEmojiUrl(emoji.id, emoji.animated);
}

export function ReactionEmoji({
  emoji,
  className,
}: {
  emoji: MessageReaction["emoji"];
  className?: string;
}) {
  const customUrl = reactionCustomEmojiUrl(emoji);
  const unicodeUrl = customUrl ? null : twemojiSvgUrl(emoji.name);
  const url = customUrl ?? unicodeUrl;

  if (url) {
    return (
      <img
        src={url}
        alt={emoji.name}
        draggable={false}
        className={cn("size-5 shrink-0 object-contain", className)}
        loading="lazy"
      />
    );
  }

  return (
    <span className={cn("text-base leading-none", className)}>{emoji.name}</span>
  );
}
