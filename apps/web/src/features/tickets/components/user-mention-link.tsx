import type { ReactNode } from "react";
import { AuthorHoverCard } from "./author-hover-card";
import { isDiscordSnowflake, useDiscordUser } from "../hooks/discord-user";
import { cn } from "@/lib/utils";

function mentionLabel(
  children: ReactNode,
  liveName: string | null | undefined,
): ReactNode {
  if (liveName) return liveName;
  return children;
}

/** Hoverable Discord user mention inside transcript markdown. */
export function UserMentionLink({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const canFetch = isDiscordSnowflake(userId);
  const query = useDiscordUser(userId, canFetch);
  const liveName =
    query.data && !query.data.unavailable
      ? (query.data.displayName ?? query.data.username)
      : null;

  if (!canFetch) {
    return <span className="font-medium text-primary">{children}</span>;
  }

  return (
    <AuthorHoverCard userId={userId}>
      <span
        className={cn(
          "inline font-medium text-primary bg-primary/10 rounded-md px-1 py-0.5",
        )}
      >
        @{mentionLabel(children, liveName)}
      </span>
    </AuthorHoverCard>
  );
}
