import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  claimSetup,
  completeSetup,
  fetchSetupGuilds,
  fetchSetupResources,
  fetchSetupStatus,
  saveChannelStrategy,
  saveRolePermissions,
  saveSetupGuilds,
} from "../api/setup";

const setupStatusKey = ["setup", "status"] as const;
const setupGuildsKey = ["setup", "guilds"] as const;

export function useSetupStatus(enabled = true) {
  return useQuery({
    queryKey: setupStatusKey,
    queryFn: fetchSetupStatus,
    enabled,
    staleTime: 30_000,
  });
}

export function useSetupGuilds(enabled = true) {
  return useQuery({
    queryKey: setupGuildsKey,
    queryFn: () => fetchSetupGuilds(),
    enabled,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });
}

export function useRefreshSetupGuilds() {
  const queryClient = useQueryClient();

  return () =>
    queryClient.fetchQuery({
      queryKey: setupGuildsKey,
      queryFn: () => fetchSetupGuilds({ refresh: true }),
    });
}

export function useSetupResources(guildId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["setup", "guild", guildId, "resources"] as const,
    queryFn: () => fetchSetupResources(guildId!),
    enabled: enabled && Boolean(guildId),
  });
}

export function useClaimSetup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: claimSetup,
    onSuccess: () => invalidateSetup(queryClient),
  });
}

export function useSaveSetupGuilds() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveSetupGuilds,
    onSuccess: () => invalidateSetup(queryClient),
  });
}

export function useSaveChannelStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveChannelStrategy,
    onSuccess: () => invalidateSetup(queryClient),
  });
}

export function useSaveRolePermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveRolePermissions,
    onSuccess: () => invalidateSetup(queryClient),
  });
}

export function useCompleteSetup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: completeSetup,
    onSuccess: () => invalidateSetup(queryClient),
  });
}

function invalidateSetup(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["setup"] });
}
