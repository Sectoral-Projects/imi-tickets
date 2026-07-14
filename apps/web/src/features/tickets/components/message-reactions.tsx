import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useState, type ReactNode } from "react";
import {
  isDiscordSnowflake,
  useDiscordUser,
} from "../hooks/discord-user";
import type { MessageReaction } from "../schemas/messages";
import { ReactionEmoji } from "./reaction-emoji";

function discordAvatarUrl(userId: string, avatar: string | null | undefined) {
  if (!avatar) return undefined;
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png`;
}

function ReactorRow({
  userId,
  enabled,
}: {
  userId: string;
  enabled: boolean;
}) {
  const canFetch = isDiscordSnowflake(userId);
  const query = useDiscordUser(userId, enabled && canFetch);
  const displayName =
    query.data?.displayName ??
    query.data?.username ??
    (canFetch ? null : userId);

  if (!enabled) return null;

  if (query.isLoading) {
    return (
      <li className="flex items-center gap-2 px-1 py-1">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </li>
    );
  }

  const name = displayName ?? "Unknown user";
  const avatarSrc = query.data
    ? discordAvatarUrl(query.data.userId, query.data.avatar)
    : undefined;

  return (
    <li className="flex min-w-0 items-center gap-2 rounded-md px-1 py-1">
      <Avatar size="sm" className="shrink-0">
        <AvatarImage src={avatarSrc} alt={name} />
        <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        {query.data?.username &&
        query.data.displayName &&
        query.data.username !== query.data.displayName ? (
          <p className="truncate text-[11px] text-muted-foreground">
            @{query.data.username}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function ReactionUsersHoverCard({
  reaction,
  children,
}: {
  reaction: MessageReaction;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const count = reaction.userIds.length;

  return (
    <HoverCard open={open} onOpenChange={setOpen}>
      <HoverCardTrigger
        render={
          <button
            type="button"
            className="border-0 bg-transparent p-0"
            onClick={(event) => event.stopPropagation()}
          />
        }
      >
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        className="w-64 gap-0 p-0"
        side="top"
        align="start"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
          <ReactionEmoji emoji={reaction.emoji} />
          <p className="text-xs font-medium text-muted-foreground">
            {count} reaction{count === 1 ? "" : "s"}
          </p>
        </div>
        <ul className="max-h-56 overflow-y-auto p-1.5">
          {reaction.userIds.map((userId) => (
            <ReactorRow key={userId} userId={userId} enabled={open} />
          ))}
        </ul>
      </HoverCardContent>
    </HoverCard>
  );
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
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {reactions.map((reaction) => {
        const reacted = Boolean(
          currentUserId && reaction.userIds.includes(currentUserId),
        );

        return (
          <ReactionUsersHoverCard
            key={`${reaction.emoji.id ?? reaction.emoji.name}`}
            reaction={reaction}
          >
            <span
              className={cn(
                "inline-flex h-7 min-w-7 cursor-default items-center gap-1.5 rounded-lg px-2 text-sm font-medium tabular-nums transition-colors",
                reacted
                  ? "border border-primary/25 bg-primary/10 text-primary"
                  : "border border-transparent bg-muted/70 text-muted-foreground hover:border-border hover:bg-muted",
              )}
            >
              <ReactionEmoji emoji={reaction.emoji} />
              <span>{reaction.count}</span>
            </span>
          </ReactionUsersHoverCard>
        );
      })}
    </div>
  );
}
