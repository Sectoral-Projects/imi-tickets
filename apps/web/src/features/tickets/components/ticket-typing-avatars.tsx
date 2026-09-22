import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import type { TicketTyper } from "../lib/ticket-typing";
import { AuthorHoverCard } from "./author-hover-card";

const MAX_VISIBLE_AVATARS = 3;

function typerLabel(typer: TicketTyper) {
  return typer.globalName ?? typer.username ?? typer.userId;
}

function discordAvatarUrl(userId: string, avatar: string | null) {
  if (!avatar) return undefined;
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png`;
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      <span className="size-1.5 rounded-full bg-muted-foreground animate-typing-dot" />
      <span className="size-1.5 rounded-full bg-muted-foreground animate-typing-dot [animation-delay:150ms]" />
      <span className="size-1.5 rounded-full bg-muted-foreground animate-typing-dot [animation-delay:300ms]" />
    </span>
  );
}

export function TicketTypingAvatars({ typers }: { typers: TicketTyper[] }) {
  if (typers.length === 0) return null;

  const visible = typers.slice(0, MAX_VISIBLE_AVATARS);
  const overflow = typers.length - visible.length;
  const names = typers.map(typerLabel).join(", ");
  const phrase = typers.length === 1 ? "is typing" : "are typing";

  return (
    <div className="pointer-events-auto relative z-10 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2 py-1">
      <span className="sr-only">
        {names} {phrase}
      </span>
      <TypingDots />
      <AvatarGroup className="shrink-0">
        {visible.map((typer) => {
          const name = typerLabel(typer);
          return (
            <AuthorHoverCard
              key={typer.userId}
              userId={typer.userId}
              side="top"
              align="end"
              className="relative z-0 hover:z-10"
            >
              <Avatar
                size="sm"
                className="ring-2 ring-muted"
                aria-label={`${name} ${phrase}`}
              >
                <AvatarImage
                  src={discordAvatarUrl(typer.userId, typer.avatar)}
                  alt={name}
                />
                <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            </AuthorHoverCard>
          );
        })}
        {overflow > 0 ? (
          <AvatarGroupCount className="size-6 bg-muted text-[10px] ring-2 ring-muted">
            +{overflow}
          </AvatarGroupCount>
        ) : null}
      </AvatarGroup>
      <span className="text-xs text-muted-foreground">{phrase}</span>
    </div>
  );
}
