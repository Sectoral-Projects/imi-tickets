import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export type DiscordUserRole = {
  id: string;
  name: string;
  color: number;
  position: number;
};

export type DiscordUserProfile = {
  userId: string;
  username: string | null;
  globalName: string | null;
  displayName: string | null;
  avatar: string | null;
  /** Primary-guild roles when the bot can resolve membership; null if no primary guild. */
  roles: DiscordUserRole[] | null;
  unavailable: boolean;
};

const SNOWFLAKE_RE = /^\d{17,20}$/;

export function isDiscordSnowflake(userId: string) {
  return SNOWFLAKE_RE.test(userId);
}

export function fetchDiscordUser(userId: string) {
  return api.get<DiscordUserProfile>(`/discord/users/${encodeURIComponent(userId)}`);
}

export function useDiscordUser(userId: string | null | undefined, enabled: boolean) {
  const safeId = userId?.trim() ?? "";
  const canFetch = Boolean(enabled && safeId && isDiscordSnowflake(safeId));

  return useQuery({
    queryKey: ["discord-user", safeId],
    queryFn: () => fetchDiscordUser(safeId),
    enabled: canFetch,
    staleTime: 5 * 60_000,
    retry: false,
  });
}
