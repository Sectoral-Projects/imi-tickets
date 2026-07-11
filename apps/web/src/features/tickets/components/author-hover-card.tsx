import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, type ReactNode } from "react";
import {
  isDiscordSnowflake,
  useDiscordUser,
  type DiscordUserRole,
} from "../hooks/discord-user";

const MAX_VISIBLE_ROLES = 8;

function avatarUrl(userId: string, avatar: string | null | undefined) {
  if (!avatar) return undefined;
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png`;
}

/** Discord role colors are API integers; 0 means default/no color. */
function roleSwatchStyle(color: number): { backgroundColor: string } | undefined {
  if (!color) return undefined;
  return { backgroundColor: `#${color.toString(16).padStart(6, "0")}` };
}

function RoleList({ roles }: { roles: DiscordUserRole[] }) {
  const visible = roles.slice(0, MAX_VISIBLE_ROLES);
  const remaining = roles.length - visible.length;

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((role) => {
        const swatch = roleSwatchStyle(role.color);
        return (
          <Badge key={role.id} variant="outline" className="max-w-full gap-1.5">
            <span
              className="size-2 shrink-0 rounded-full bg-muted-foreground/40"
              style={swatch}
              aria-hidden
            />
            <span className="truncate">{role.name}</span>
          </Badge>
        );
      })}
      {remaining > 0 ? (
        <Badge variant="secondary">+{remaining} more</Badge>
      ) : null}
    </div>
  );
}

export function AuthorHoverCard({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const canFetch = isDiscordSnowflake(userId);
  const query = useDiscordUser(userId, open && canFetch);

  if (!canFetch) {
    return <>{children}</>;
  }

  return (
    <HoverCard open={open} onOpenChange={setOpen}>
      <HoverCardTrigger
        render={
          <button
            type="button"
            className="inline-flex cursor-default border-0 bg-transparent p-0 text-left"
          />
        }
      >
        {children}
      </HoverCardTrigger>
      <HoverCardContent className="w-72" side="right" align="start">
        {query.isLoading ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          </div>
        ) : query.data && !query.data.unavailable ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarImage
                  src={avatarUrl(query.data.userId, query.data.avatar)}
                  alt={query.data.displayName ?? query.data.username ?? "User"}
                />
                <AvatarFallback>
                  {(query.data.displayName ?? query.data.username ?? "?")
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {query.data.displayName ?? query.data.username}
                </p>
                {query.data.username ? (
                  <p className="truncate text-xs text-muted-foreground">
                    @{query.data.username}
                  </p>
                ) : null}
              </div>
            </div>
            {query.data.roles && query.data.roles.length > 0 ? (
              <RoleList roles={query.data.roles} />
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Current Discord details are unavailable for this user.
          </p>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
